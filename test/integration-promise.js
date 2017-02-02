'use strict';

const Code = require('code');
const Lab = require('lab');
const Exceptions = require('../lib/exceptions');
const Assertions = require('./assertions');

const lab = exports.lab = Lab.script();
const before = lab.before;
const beforeEach = lab.beforeEach;
const after = lab.after;
const afterEach = lab.afterEach;
const describe = lab.describe;
const it = lab.it;
const expect = Code.expect;

const BunnyBus = require('../lib');
let instance = undefined;

const throwError = () => {

    throw new Error('Test should not have reached the .then block');
};

describe('positive integration tests - Promise api', () => {

    before((done) => {

        instance = new BunnyBus();
        instance.config = BunnyBus.DEFAULT_SERVER_CONFIGURATION;
        done();
    });

    describe('connection', () => {

        before(() => {

            return instance.closeConnection();
        });

        afterEach(() => {

            return instance.closeConnection();
        });

        it('should create connection with default values', () => {

            return instance.createConnection()
                .then(() => {

                    expect(instance.connection).to.not.be.null();
                });
        });

        it('should close an opened connection', () => {

            return instance.createConnection()
                .then(instance.closeConnection)
                .then(() => {

                    expect(instance.connection).to.be.null();
                });
        });
    });

    describe('channel', () => {

        before(() => {

            return instance.closeChannel();
        });

        beforeEach(() => {

            return instance.closeChannel()
                .then(instance.createConnection);
        });

        it('should create channel with default values', () => {

            return instance.createChannel()
                .then(() => {

                    expect(instance.channel).to.exist();
                });
        });

        it('should close an opened channel', () => {

            return instance.createChannel()
                .then(instance.closeChannel)
                .then(() => {

                    expect(instance.channel).to.be.null();
                });
        });

        it('should close both connection and channel when closing a connection', () => {

            return instance.createChannel()
                .then(instance.closeConnection)
                .then(() => {

                    expect(instance.connection).to.be.null();
                    expect(instance.channel).to.be.null();
                });
        });
    });

    describe('_autoConnectChannel', () => {

        beforeEach(() => {

            return instance.closeConnection();
        });

        it('should create connection and channel', () => {

            return instance._autoConnectChannel()
                .then(() => {


                    expect(instance.connection).to.exist();
                    expect(instance.channel).to.exist();
                });
        });

        it('should create connection and channel properly with no race condition', () => {

            return Promise.all([
                instance._autoConnectChannel(),
                instance._autoConnectChannel(),
                instance._autoConnectChannel(),
                instance._autoConnectChannel()
            ])
                .then(() => {

                    expect(instance.connection).to.exist();
                    expect(instance.channel).to.exist();
                });
        });
    });

    describe('_recoverConnectChannel', () => {

        beforeEach(() => {

            return instance._autoConnectChannel();
        });

        afterEach(() => {

            return instance.closeConnection();
        });

        it('should recreate connection when connection error occurs', (done) => {

            instance.connection.emit('error');

            setTimeout(() => {

                expect(instance.connection).to.exist();
                expect(instance.channel).to.exist();
                done();
            }, 100);
        });

        it('should recreate connection when channel error occurs', (done) => {

            instance.channel.emit('error');

            setTimeout(() => {

                expect(instance.connection).to.exist();
                expect(instance.channel).to.exist();
                done();
            }, 100);
        });
    });

    describe('queue', () => {

        const queueName = 'test-queue-1';

        beforeEach(() => {

            return instance._autoConnectChannel();
        });

        it('should create queue with name `test-queue-1`', () => {

            return instance.createQueue(queueName)
                .then((result) => {

                    expect(result.queue).to.be.equal(queueName);
                    expect(result.messageCount).to.be.equal(0);
                });
        });

        it('should check queue with name `test-queue-1`', () => {

            return instance.checkQueue(queueName)
                .then((result) => {

                    expect(result.queue).to.be.equal(queueName);
                    expect(result.messageCount).to.be.equal(0);
                });
        });

        it('should delete queue with name `test-queue-1`', () => {

            return instance.deleteQueue(queueName)
                .then((result) => {

                    expect(result.messageCount).to.be.equal(0);
                });
        });
    });

    describe('exchange', () => {

        const exchangeName = 'test-exchange-1';

        before(() => {

            return instance._autoConnectChannel()
                .then(instance.deleteExchange.bind(instance, exchangeName));
        });

        beforeEach(() => {

            return instance._autoConnectChannel();
        });

        it('should create exchange with name `test-exchange-1`', () => {

            return instance.createExchange(exchangeName, 'topic');
        });

        it('should check exchange with name `test-exchange-1`', () => {

            return instance.checkExchange(exchangeName);
        });

        it('should delete exchange with name `test-exchange-1`', () => {

            return instance.deleteExchange(exchangeName);
        });
    });

    describe('send / get', () => {

        const queueName = 'test-send-queue-1';
        const message = { name : 'bunnybus' };

        beforeEach(() => {

            return instance.closeConnection();
        });

        afterEach(() => {

            return instance.deleteQueue(queueName);
        });

        it('should send message', () => {

            return Assertions.assertSendPromise(instance, message, queueName, null, null);
        });

        it('should proxy `callingModule` when supplied', () => {

            return Assertions.assertSendPromise(instance, message, queueName, null, 'someModule');
        });

        it('should proxy `transactionId` when supplied', () => {

            return Assertions.assertSendPromise(instance, message, queueName, 'someTransactionId', null);
        });
    });

    describe('publish', () => {

        const queueName = 'test-publish-queue-1';
        const message = { name : 'bunnybus' };
        const patterns = ['a', 'a.b', 'b', 'b.b', 'z.*'];

        before(() => {

            return instance._autoConnectChannel()
                .then(instance.createExchange.bind(instance, instance.config.globalExchange, 'topic'))
                .then(instance.createQueue.bind(instance, queueName))
                .then(() => {

                    const promises = patterns.map((pattern) => {

                        return instance.channel.bindQueue(queueName, instance.config.globalExchange, pattern);
                    });

                    return Promise.all(promises);
                });
        });

        after(() => {

            return instance._autoConnectChannel()
                .then(instance.deleteExchange.bind(instance, instance.config.globalExchange))
                .then(instance.deleteQueue.bind(instance, queueName));
        });

        it('should publish for route `a`', () => {

            return Assertions.assertPublishPromise(instance, message, queueName, 'a', null, null, true);
        });

        it('should publish for route `a.b`', () => {

            return Assertions.assertPublishPromise(instance, message, queueName, 'a.b', null, null, true);
        });

        it('should publish for route `b`', () => {

            return Assertions.assertPublishPromise(instance, message, queueName, 'b', null, null, true);
        });

        it('should publish for route `b.b`', () => {

            return Assertions.assertPublishPromise(instance, message, queueName, 'b.b', null, null, true);
        });

        it('should publish for route `z.a`', () => {

            return Assertions.assertPublishPromise(instance, message, queueName, 'z.a', null, null, true);
        });

        it('should publish for route `z` but not route to queue', () => {

            return Assertions.assertPublishPromise(instance, message, queueName, 'z', null, null, false);
        });

        it('should proxy `callingModule` when supplied', () => {

            return Assertions.assertPublishPromise(instance, message, queueName, 'a', null, 'someModule', true);
        });

        it('should proxy `transactionId` when supplied', () => {

            return Assertions.assertPublishPromise(instance, message, queueName, 'a', 'someTransactionId', null, true);
        });

        it('should publish for route `a` when route key is provided in the message', () => {

            const messageWithRoute = Object.assign({}, message, { event : 'a' });

            return Assertions.assertPublishPromise(instance, messageWithRoute, queueName, null, null, null, true);
        });
    });

    describe('subscribe / unsubscribe (single queue)', () => {

        const queueName = 'test-subscribe-queue-1';
        const errorQueueName = `${queueName}_error`;
        const message = { event : 'a.b', name : 'bunnybus' };

        before(() => {

            return instance._autoConnectChannel()
                .then(instance.deleteExchange.bind(instance, instance.config.globalExchange))
                .then(instance.deleteQueue.bind(instance, queueName))
                .then(instance.deleteQueue.bind(instance, errorQueueName));
        });

        afterEach(() => {

            return instance.unsubscribe(queueName);
        });

        after(() => {

            return instance._autoConnectChannel()
                .then(instance.deleteExchange.bind(instance, instance.config.globalExchange))
                .then(instance.deleteQueue.bind(instance, queueName))
                .then(instance.deleteQueue.bind(instance, errorQueueName));
        });

        it('should consume message from queue and acknowledge off', () => {

            return new Promise((resolve, reject) => {

                const handlers = {};

                handlers[message.event] = (consumedMessage, ack) => {

                    expect(consumedMessage.name).to.equal(message.name);

                    return ack()
                        .then(resolve);
                };

                return instance.subscribe(queueName, handlers)
                    .then(instance.publish.bind(instance, message))
                    .catch(reject);
            });
        });

        it('should consume message from queue and reject off', () => {

            return new Promise((resolve, reject) => {

                const handlers = {};

                handlers[message.event] = (consumedMessage, ack, rej) => {

                    expect(consumedMessage.name).to.equal(message.name);

                    return rej()
                        .then(instance.get.bind(instance, errorQueueName))
                        .then((payload) => {

                            expect(payload).to.exist();

                            const errorMessage = JSON.parse(payload.content.toString());

                            expect(errorMessage).to.equal(message);
                        })
                        .then(resolve);
                };

                return instance.subscribe(queueName, handlers)
                    .then(instance.publish.bind(instance, message))
                    .catch(reject);
            });
        });

        it('should consume message from queue and requeue off on maxRetryCount', { timeout : 0 }, () => {

            return new Promise((resolve, reject) => {

                const handlers = {};
                const maxRetryCount = 3;
                let retryCount = 0;
                handlers[message.event] = (consumedMessage, ack, rej, requeue) => {

                    ++retryCount;

                    if (retryCount < maxRetryCount) {
                        return requeue();
                    }

                    expect(retryCount).to.equal(maxRetryCount);

                    return ack()
                        .then(resolve);
                };

                return instance.subscribe(queueName, handlers, { maxRetryCount })
                    .then(instance.publish.bind(instance, message))
                    .catch(reject);
            });
        });
    });

    describe('subscribe / unsubscribe (multiple queue)', () => {

        const queueName1 = 'test-subscribe-multiple-queue-1';
        const queueName2 = 'test-subscribe-multiple-queue-2';
        const message = { event : 'a.b', name : 'bunnybus' };

        before(() => {

            return instance._autoConnectChannel()
                .then(instance.deleteExchange.bind(instance, instance.config.globalExchange))
                .then(instance.deleteQueue.bind(instance, queueName1))
                .then(instance.deleteQueue.bind(instance, queueName2));
        });

        afterEach(() => {

            return Promise.all([
                instance.unsubscribe(queueName1),
                instance.unsubscribe(queueName2)
            ]);
        });

        after(() => {

            return instance._autoConnectChannel()
                .then(instance.deleteExchange.bind(instance, instance.config.globalExchange))
                .then(instance.deleteQueue.bind(instance, queueName1))
                .then(instance.deleteQueue.bind(instance, queueName2));
        });

        it('should consume message from two queues and acknowledge off', () => {

            return new Promise((resolve, reject) => {

                const handlers = {};
                let counter = 0;

                handlers[message.event] = (consumedMessage, ack) => {

                    expect(consumedMessage.name).to.equal(message.name);

                    return ack()
                        .then(() => {

                            ++counter;
                            if (counter === 2) {
                                return resolve();
                            }
                        });
                };

                return instance.subscribe(queueName1, handlers)
                    .then(instance.subscribe.bind(instance, queueName2, handlers))
                    .then(instance.publish.bind(instance, message))
                    .catch(reject);
            });
        });
    });

    describe('_ack', () => {

        const queueName = 'test-acknowledge-queue-1';
        const message = { name : 'bunnybus', event : 'a' };
        const patterns = ['a'];

        before(() => {

            return instance._autoConnectChannel()
                .then(instance.createExchange.bind(instance, instance.config.globalExchange, 'topic'))
                .then(instance.createQueue.bind(instance, queueName))
                .then(() => {

                    const promises = patterns.map((pattern) => {

                        return instance.channel.bindQueue(queueName, instance.config.globalExchange, pattern);
                    });

                    return Promise.all(promises);
                });
        });

        after(() => {

            return instance._autoConnectChannel()
                .then(instance.deleteExchange.bind(instance, instance.config.globalExchange))
                .then(instance.deleteQueue.bind(instance, queueName));
        });

        it('should ack a message off the queue', () => {

            return instance.publish(message)
                .then(instance.get.bind(instance, queueName))
                .then(instance._ack.bind(instance))
                .then(instance.checkQueue.bind(instance, queueName))
                .then((result) => {

                    expect(result.queue).to.be.equal(queueName);
                    expect(result.messageCount).to.be.equal(0);
                });
        });
    });

    describe('_requeue', () => {

        const queueName = 'test-requeue-queue-1';
        const message = { name : 'bunnybus', event : 'a' };
        const patterns = ['a'];

        beforeEach((done) => {

            instance.channel.purgeQueue(queueName, done);
        });

        before(() => {

            return instance._autoConnectChannel()
                .then(instance.createExchange.bind(instance, instance.config.globalExchange, 'topic'))
                .then(instance.createQueue.bind(instance, queueName))
                .then(() => {

                    const promises = patterns.map((pattern) => {

                        return instance.channel.bindQueue(queueName, instance.config.globalExchange, pattern);
                    });

                    return Promise.all(promises);
                });
        });

        after(() => {

            return instance._autoConnectChannel()
                .then(instance.deleteExchange.bind(instance, instance.config.globalExchange))
                .then(instance.deleteQueue.bind(instance, queueName));
        });

        it('should requeue a message off the queue', () => {

            return instance.publish(message)
                .then(instance.get.bind(instance, queueName))
                .then((payload) => {

                    return instance._requeue(payload, queueName);
                })
                .then(instance.checkQueue.bind(instance, queueName))
                .then((result) => {

                    expect(result.queue).to.be.equal(queueName);
                    expect(result.messageCount).to.be.equal(1);
                });
        });

        it('should requeue with well formed header properties', () => {

            const publishOptions = {
                callingModule : 'test'
            };

            let transactionId = null;
            let createdAt = null;

            return instance.publish(message, publishOptions)
                .then(instance.get.bind(instance, queueName))
                .then((payload) => {

                    transactionId = payload.properties.headers.transactionId;
                    createdAt = payload.properties.headers.createdAt;

                    return instance._requeue(payload, queueName);
                })
                .then(instance.get.bind(instance, queueName))
                .then((payload) => {

                    expect(payload.properties.headers.transactionId).to.equal(transactionId);
                    expect(payload.properties.headers.createAt).to.equal(createdAt);
                    expect(payload.properties.headers.callingModule).to.equal(publishOptions.callingModule);
                    expect(payload.properties.headers.requeuedAt).to.exist();
                    expect(payload.properties.headers.retryCount).to.equal(1);
                });
        });
    });

    describe('_reject', () => {

        const errorQueueName = 'test-reject-error-queue-1';
        const queueName = 'test-reject-queue-1';
        const message = { name : 'bunnybus', event : 'a' };
        const patterns = ['a'];

        beforeEach((done) => {

            instance.channel.purgeQueue(queueName, done);
        });

        before(() => {

            return instance._autoConnectChannel()
                .then(instance.createExchange.bind(instance, instance.config.globalExchange, 'topic'))
                .then(instance.createQueue.bind(instance, queueName))
                .then(() => {

                    const promises = patterns.map((pattern) => {

                        return instance.channel.bindQueue(queueName, instance.config.globalExchange, pattern);
                    });

                    return Promise.all(promises);
                });
        });

        after(() => {

            return instance._autoConnectChannel()
                .then(instance.deleteExchange.bind(instance, instance.config.globalExchange))
                .then(instance.deleteQueue.bind(instance, queueName));
        });

        afterEach(() => {

            return instance.deleteQueue(errorQueueName);
        });

        it('should reject a message off the queue', () => {

            return instance.publish(message)
                .then(instance.get.bind(instance, queueName))
                .then((payload) => {

                    return instance._reject(payload, errorQueueName);
                })
                .then(instance.checkQueue.bind(instance, errorQueueName))
                .then((result) => {

                    expect(result.queue).to.be.equal(errorQueueName);
                    expect(result.messageCount).to.be.equal(1);
                });
        });

        it('should requeue with well formed header properties', () => {

            const publishOptions = {
                callingModule : 'test'
            };
            const requeuedAt = (new Date()).toISOString();
            const retryCount = 5;
            let transactionId = null;
            let createdAt = null;

            return instance.publish(message, publishOptions)
                .then(instance.get.bind(instance, queueName))
                .then((payload) => {

                    transactionId = payload.properties.headers.transactionId;
                    createdAt = payload.properties.headers.createdAt;
                    payload.properties.headers.requeuedAt = requeuedAt;
                    payload.properties.headers.retryCount = retryCount;

                    return instance._reject(payload, errorQueueName);
                })
                .then(instance.get.bind(instance, errorQueueName))
                .then((payload) => {

                    expect(payload.properties.headers.transactionId).to.equal(transactionId);
                    expect(payload.properties.headers.createAt).to.equal(createdAt);
                    expect(payload.properties.headers.callingModule).to.equal(publishOptions.callingModule);
                    expect(payload.properties.headers.requeuedAt).to.equal(requeuedAt);
                    expect(payload.properties.headers.retryCount).to.equal(retryCount);
                    expect(payload.properties.headers.errorAt).to.exist();
                });
        });
    });
});

describe('negative integration tests', () => {

    before((done) => {

        instance = new BunnyBus();
        instance.config = BunnyBus.DEFAULT_SERVER_CONFIGURATION;
        done();
    });

    describe('channel', () => {

        beforeEach(() => {

            return instance.closeConnection();
        });

        it('should throw NoConnectionError when connection does not pre-exist', () => {

            return instance.createChannel()
                .then(throwError)
                .catch((err) => {

                    expect(err).to.be.an.error(Exceptions.NoConnectionError);
                });
        });
    });

    describe('queue', () => {

        const queueName = 'test-queue-1';

        beforeEach(() => {

            return instance.closeConnection();
        });

        it('should throw NoChannelError when calling createQueue and connection does not pre-exist', () => {

            return instance.createQueue(queueName)
                .then(throwError)
                .catch((err) => {

                    expect(err).to.be.an.error(Exceptions.NoChannelError);
                });
        });

        it('should throw NoChannelError when calling checkQueue and connection does not pre-exist', () => {

            return instance.checkQueue(queueName)
                .then(throwError)
                .catch((err) => {

                    expect(err).to.be.an.error(Exceptions.NoChannelError);
                });
        });

        it('should throw NoChannelError when calling deleteQueue and connection does not pre-exist', () => {

            return instance.deleteQueue(queueName)
                .then(throwError)
                .catch((err) => {

                    expect(err).to.be.an.error(Exceptions.NoChannelError);
                });
        });
    });

    describe('exchange', () => {

        const exchangeName = 'test-exchange-1';

        beforeEach(() => {

            return instance.closeConnection();
        });

        it('should throw NoChannelError when calling createExchange and connection does not pre-exist', () => {

            return instance.createExchange(exchangeName, '')
                .then(throwError)
                .catch((err) => {

                    expect(err).to.be.an.error(Exceptions.NoChannelError);
                });
        });

        it('should throw NoChannelError when calling checkExchange and connection does not pre-exist', () => {

            return instance.checkExchange(exchangeName)
                .then(throwError)
                .catch((err) => {

                    expect(err).to.be.an.error(Exceptions.NoChannelError);
                });
        });

        it('should throw NoChannelError when calling deleteExchange and connection does not pre-exist', () => {

            return instance.deleteExchange(exchangeName)
                .then(throwError)
                .catch((err) => {

                    expect(err).to.be.an.error(Exceptions.NoChannelError);
                });
        });
    });

    describe('get', () => {

        const queueName = 'test-queue-1';

        beforeEach(() => {

            return instance.closeConnection();
        });

        it('should throw NoChannelError when calling get and connection does not pre-exist', () => {

            return instance.get(queueName)
                .then(throwError)
                .catch((err) => {

                    expect(err).to.be.an.error(Exceptions.NoChannelError);
                });
        });
    });

    describe('publish', () => {

        const message = { name : 'bunnybus' };

        it('should throw NoRouteKeyError when calling publish and `options.routeKey` nor `message.event` exist', () => {

            return instance.publish(message)
                .then(throwError)
                .catch((err) => {

                    expect(err).to.be.an.error(Exceptions.NoRouteKeyError);
                });
        });
    });

    describe('acknowledge', () => {

        const payload = {
            content : new Buffer('hello')
        };

        beforeEach(() => {

            return instance.closeConnection();
        });

        it('should throw NoChannelError when calling _ack and connection does not pre-exist', () => {

            return instance._ack(payload)
                .then(throwError)
                .catch((err) => {

                    expect(err).to.be.an.error(Exceptions.NoChannelError);
                });
        });
    });

    describe('requeue', () => {

        const payload = {
            content : new Buffer('hello')
        };

        beforeEach(() => {

            return instance.closeConnection();
        });

        it('should throw NoChannelError when calling _requeue and connection does not pre-exist', () => {

            return instance._requeue(payload, '')
                .then(throwError)
                .catch((err) => {

                    expect(err).to.be.an.error(Exceptions.NoChannelError);
                });
        });
    });

    describe('reject', () => {

        const payload = {
            content : new Buffer('hello')
        };

        beforeEach(() => {

            return instance.closeConnection();
        });

        it('should throw NoChannelError when calling _reject and connection does not pre-exist', () => {

            return instance._reject(payload, '')
                .then(throwError)
                .catch((err) => {

                    expect(err).to.be.an.error(Exceptions.NoChannelError);
                });
        });
    });
});