/*
 * Filename: /Users/naviocean/Working/HAWKING/ssc/utils.js
 * Path: /Users/naviocean/Working/HAWKING/ssc
 * Created Date: Tuesday, September 11th 2018, 9:56:30 am
 * Author: Navi Ocean
 * 
 * Copyright (c) 2018 Hawking LLC
 */
const StellarSdk = require('stellar-sdk');
const configs = require('./configs');

class SscUtils {
	constructor() {
		this.hawkingAsset = new StellarSdk.Asset(
			'HAWKING',
			configs.issueAccount.public
		);
		this.nativeAsset = StellarSdk.Asset.native();
	}
	loadAccount(public_key) {
		return new Promise(async (resolve, reject) => {
			try {
				const account = await configs.server.loadAccount(public_key);
				account.balances.forEach(function(balance) {
					if (balance.asset_code !== 'HAWKING')
						console.log(
							'Type:',
							balance.asset_type,
							'Asset: ',
							balance.asset_code,
							'Balance:',
							balance.balance
						);
				});
				return resolve(account);
			} catch (err) {
				console.log('loadAccount error ', err);
				return reject(err);
			}
		});
	}

	showSigner(public_key) {
		return new Promise(async (resolve, reject) => {
			try {
				const account = await configs.server.loadAccount(public_key);
				console.log(account.thresholds);
				account.signers.forEach(function(signer) {
					console.log(signer);
				});
				return resolve(account);
			} catch (err) {
				console.log('loadAccount error ', err);
				return reject(err);
			}
		});
	}

	fundAccount(source, destination, amount = 5) {
		return new Promise((resolve, reject) => {
			configs.server
				.loadAccount(source.publicKey())
				.then(function(sourceAccount) {
					let transaction = new StellarSdk.TransactionBuilder(sourceAccount)
						.addOperation(
							StellarSdk.Operation.createAccount({
								destination: destination,
								startingBalance: amount.toString() //XLM
							})
						)
						.build();
					// Sign the transaction to prove you are actually the person sending it.
					transaction.sign(source);
					// And finally, send it off to Stellar!
					return configs.server.submitTransaction(transaction);
				})
				.then(function(result) {
					// console.log("Success! Results:", result);
					return resolve(result);
				})
				.catch(function(error) {
					console.error('Something went wrong!', error);
					return reject(error);
				});
		});
	}

	trustAccount(account) {
		return new Promise(async (resolve, reject) => {
			try {
				const receivingKeys = StellarSdk.Keypair.fromSecret(
					account.private_key
				);
				console.log('loading receiver account');
				const receiver = await this.loadAccount(account.public_key);

				console.log('trusting hawking asset');
				let transaction = new StellarSdk.TransactionBuilder(receiver)
					// The `changeTrust` operation creates (or alters) a trustline
					.addOperation(
						StellarSdk.Operation.changeTrust({
							asset: this.hawkingAsset
						})
					)
					.build();

				transaction.sign(receivingKeys);

				const submit = await configs.server.submitTransaction(transaction);
				// console.log(submit);
				return resolve(submit);
			} catch (err) {
				console.log('trust account error', err);
				return reject(err);
			}
		});
	}

	createAccount(fundAccount, amount = 5) {
		return new Promise(async (resolve, reject) => {
			try {
				const account = StellarSdk.Keypair.random();
				await this.fundAccount(fundAccount, account.publicKey(), amount);
				console.log(account.publicKey());
				console.log(account.secret());
				return resolve(account);
			} catch (error) {
				return reject(error);
			}
		});
	}
}

module.exports = new SscUtils();
