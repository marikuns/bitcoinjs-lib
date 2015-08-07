/* global describe, it */

var assert = require('assert')
var bitcoin = require('../../')
var blockchain = new (require('cb-insight'))('https://test-insight.bitpay.com')
var faucetWithdraw = require('./utils').faucetWithdraw
var pollUnspent = require('./utils').pollUnspent

describe('bitcoinjs-lib (advanced)', function () {
  it('can sign a Bitcoin message', function () {
    var keyPair = bitcoin.ECPair.fromWIF('5KYZdUEo39z3FPrtuX2QbbwGnNP5zTd7yyr2SC1j299sBCnWjss')
    var message = 'This is an example of a signed message.'

    var signature = bitcoin.message.sign(keyPair, message)
    assert.strictEqual(signature.toString('base64'), 'G9L5yLFjti0QTHhPyFrZCT1V/MMnBtXKmoiKDZ78NDBjERki6ZTQZdSMCtkgoNmp17By9ItJr8o7ChX0XxY91nk=')
  })

  it('can verify a Bitcoin message', function () {
    var address = '1HZwkjkeaoZfTSaJxDw6aKkxp45agDiEzN'
    var signature = 'HJLQlDWLyb1Ef8bQKEISzFbDAKctIlaqOpGbrk3YVtRsjmC61lpE5ErkPRUFtDKtx98vHFGUWlFhsh3DiW6N0rE'
    var message = 'This is an example of a signed message.'

    assert(bitcoin.message.verify(address, signature, message))
  })

  it('can create an OP_RETURN transaction', function (done) {
    this.timeout(20000)

    var network = bitcoin.networks.testnet
    var keyPair = bitcoin.ECPair.makeRandom({ network: network })
    var address = keyPair.getAddress()

    faucetWithdraw(address, 2e4, function (err) {
      if (err) return done(err)

      pollUnspent(blockchain, address, function (err, unspents) {
        if (err) return done(err)

        var tx = new bitcoin.TransactionBuilder(network)
        var data = new Buffer('bitcoinjs-lib')
        var dataScript = bitcoin.scripts.nullDataOutput(data)

        var unspent = unspents.pop()

        tx.addInput(unspent.txId, unspent.vout)
        tx.addOutput(dataScript, 1000)
        tx.sign(0, keyPair)

        var txBuilt = tx.build()

        blockchain.transactions.propagate(txBuilt.toHex(), function (err) {
          if (err) return done(err)

          // check that the message was propagated
          blockchain.transactions.get(txBuilt.getId(), function (err, transaction) {
            if (err) return done(err)

            var actual = bitcoin.Transaction.fromHex(transaction.txHex)
            var dataScript2 = actual.outs[0].script
            var data2 = dataScript2.chunks[1]

            assert.deepEqual(dataScript, dataScript2)
            assert.deepEqual(data, data2)

            done()
          })
        })
      })
    })
  })
})
