'use strict';

const Helpers = require('../../lib/helpers');
const Code = require('code');
const expect = Code.expect;

const assertReduceCallback = (...args) => {

    const result = Helpers.reduceCallback.apply(this, args);

    expect(result).to.be.a.function();
};

module.exports = assertReduceCallback;
