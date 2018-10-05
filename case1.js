/*
 * Filename: /Users/naviocean/Working/HAWKING/ssc/case1.js
 * Path: /Users/naviocean/Working/HAWKING/ssc
 * Created Date: Tuesday, September 11th 2018, 9:56:22 am
 * Author: Navi Ocean
 * 
 * Copyright (c) 2018 Hawking LLC
 */

/*
This case apply for ICO
The problem is that A (Source) sells 100XLM tokens to B (Destination), under condition that B wont resell tokens until X time has passed.
A doesnt completely trust B so A suggests that A holds the tokens for B for X time
B protests. How will B know that A will still have the tokens after X time? How can B trust A to eventually deliver them?
Additionally, B is sometimes forgetful. There’s a chance B won’t remember to claim B's tokens at the end of the year long waiting period. 
A would like to build in a recovery mechanism so that if B doesn’t claim the tokens, they can be recovered. 
This way, the tokens won’t be lost forever.

Url: https://www.stellar.org/developers/guides/walkthroughs/stellar-smart-contracts.html#2-party-multisignature-escrow-account-with-time-lock-recovery
*/

const StellarSdk = require('stellar-sdk');
const configs = require('./configs');
const sscutils = require('./utils');

const server = configs.server;

const sleepTime = mins => {
	return new Promise(resolve => setTimeout(resolve, mins * 60 * 1000));
};

const main = async () => {
	// PREPARE DATA
	// need fundAccount to fund XLM to active new account
	const fundAccount = StellarSdk.Keypair.fromSecret(
		configs.hawkingAccount.secret
	);
	// create A source account with 500 XLM
	console.log('----source account ------');
	const source = await sscutils.createAccount(fundAccount, 500);
	// console.log('source', source.secret());
	// process.exit();
	// const source = StellarSdk.Keypair.fromSecret(
	// 	'SCCJ4OD6H3FTV3NUGNUTIV3HY4NAFVMNNEA6SMJAU56ZZXFIIFCWSR62'
	// );

	// console.log('public: ', source.publicKey());
	// console.log('sercet: ', source.secret());
	// create B destination account with 2.5 XLM (to active account)
	console.log('----destination account ------');
	const destination = await sscutils.createAccount(fundAccount, 2.5);
	// const destination = StellarSdk.Keypair.fromSecret(
	//	 'SBZSPGFBEDYPXSSB3MD47363WZ6EPZGCTYBSFPD5BXPODGRDDK3MULWS'
	// );

	// set X time to holds tokens is 0.5 mins
	const X = 0.5;
	// Number tokes A sell to B
	const TOKENS = 100;

	// NOW BEGIN AT HERE

	// /*
	// Transaction 1: Creating the Escrow Account from A source
	// Account: source account
	// Sequence Number: M
	// */
	console.log('-----------------------------------------------------');
	console.log('------------------Transaction 1----------------------');
	console.log('------------------Create Escrow----------------------');
	console.log('-----------------------------------------------------');
	const escrow = await sscutils.createAccount(source, 2).catch(err => {
		console.log('Error!', err);
	});
	// const escrow = StellarSdk.Keypair.fromSecret(
	// 	'SASATSU3R7V4FAA53GYPIEHLJT4FB7IF4LCLJ2FBV3ZFB6P23UHU6J4W'
	// );
	// console.log(escrow.publicKey());

	// /*
	// Transaction 2: Enabling Multi-sig
	// Account: escrow account
	// Sequence Number: N
	// */
	console.log('-----------------------------------------------------');
	console.log('------------------Transacation 2---------------------');
	console.log('-----------------------------------------------------');
	const escrowAccount = await sscutils.loadAccount(escrow.publicKey());
	const transaction2 = new StellarSdk.TransactionBuilder(escrowAccount)
		.addOperation(
			StellarSdk.Operation.setOptions({
				signer: {
					ed25519PublicKey: destination.publicKey(),
					weight: 1
				}
			})
		)
		.addOperation(
			StellarSdk.Operation.setOptions({
				masterWeight: 1,
				lowThreshold: 2,
				medThreshold: 2,
				highThreshold: 2
			})
		)
		.build();
	transaction2.sign(escrow);
	await server.submitTransaction(transaction2).catch(err => {
		console.log('Error!', err);
	});

	const { dest_envelope, source_envelope } = await sign_transaction(
		escrow,
		source,
		destination,
		X
	);

	await sendToEscrow(escrow, source, TOKENS);

	// await sleepTime(0.6);
	// let trx = new StellarSdk.Transaction(dest_envelope);
	// await server.submitTransaction(trx).catch(err => {
	// 	console.error('ERROR!', err.data);
	// });

	// await sscutils.showSigner(escrow.publicKey());
	// await sleepTime(1.1);
	// let trx = new StellarSdk.Transaction(source_envelope);
	// await server.submitTransaction(trx).catch(err => {
	// 	console.error('ERROR!', err.data);
	// });
	// await sscutils.showSigner(escrow.publicKey());
	// wait 0.6 mins to pass lock time
	console.log('wait 0.6 mins', new Date());
	await sleepTime(0.6);
	console.log('withdraw to destination ', new Date());

	await withdrawToDestination(dest_envelope, escrow, destination, TOKENS);

	// console.log('wait 1.1 mins', new Date());
	// await sleepTime(1.1);
	// console.log('withdraw to source ', new Date());
	// await withdrawToSource(source_envelope, escrow, source, TOKENS);
};

const sign_transaction = async (escrow, source, destination, unlock_time) => {
	/*
	Transaction 3: Unlock
	Account: escrow account
	Sequence Number: N+1
	*/
	console.log('-----------------------------------------------------');
	console.log('------------------Transacation 3---------------------');
	console.log('-----------------------------------------------------');
	const unlockDate = new Date(new Date().getTime() + unlock_time * 60000);
	console.log(`Unlock date in ${unlock_time} minutes:`, unlockDate);
	const unixUnlock = Math.round(unlockDate.getTime() / 1000);
	console.log('Unix unlock date', unixUnlock);

	const escrowAccount = await sscutils.loadAccount(escrow.publicKey());
	// increase sequenceNumber
	const sequenceNumber = escrowAccount.sequenceNumber();
	console.log('sequenceNumber', sequenceNumber);

	const transaction3 = new StellarSdk.TransactionBuilder(
		new StellarSdk.Account(escrow.publicKey(), sequenceNumber),
		{
			timebounds: {
				minTime: unixUnlock,
				maxTime: 0
			}
		}
	)
		.addOperation(
			StellarSdk.Operation.setOptions({
				masterWeight: 0, //escrow account can not do anything
				lowThreshold: 1,
				medThreshold: 1,
				highThreshold: 1
			})
		)
		.build();
	transaction3.sign(StellarSdk.Keypair.fromSecret(escrow.secret()));
	transaction3.sign(StellarSdk.Keypair.fromSecret(destination.secret()));
	const dest_envelope = transaction3.toEnvelope().toXDR('base64');
	console.log('dest_envelope:', dest_envelope);
	console.log('transaction3.sequence', transaction3.sequence);
	console.log('-----------------------------------------------------');
	console.log('------------------Transacation 4---------------------');
	console.log('-----------------------------------------------------');
	const recoveryDate = new Date(unlockDate.getTime() + unlock_time * 60000);
	const recoveryTime = unlockDate.getTime() / 60000 + unlock_time;
	console.log(`Unlock date in ${recoveryTime} minutes:`, recoveryDate);
	const unixRecovery = Math.round(recoveryDate.getTime() / 1000);
	console.log('Unix recovery time', unixRecovery);
	/*
	Transaction 4: Recovery
	Account: escrow account
	Sequence Number: N+1
	2 options at here:
		1. set master weight 1 (use escrow secret to make a payment)
		2. add source account as signer
	remove the destination account as signer (weight:0)
	*/

	// OPTION 1

	// const transaction4 = new StellarSdk.TransactionBuilder(
	// 	new StellarSdk.Account(escrow.publicKey(), sequenceNumber),
	// 	{
	// 		timebounds: {
	// 			minTime: unixRecovery,
	// 			maxTime: 0
	// 		}
	// 	}
	// )
	// .addOperation(
	// 	StellarSdk.Operation.setOptions({
	// 		signer: {
	// 			ed25519PublicKey: destination.publicKey(),
	// 			weight: 0 //remove the destination account as a signer
	// 		},
	// 	})
	// )
	// 	.addOperation(
	// 		StellarSdk.Operation.setOptions({
	// 			masterWeight: 1,
	// 			lowThreshold: 1,
	// 			medThreshold: 1,
	// 			highThreshold: 1
	// 		})
	// 	)
	// 	.build();

	// OPTION 2
	const transaction4 = new StellarSdk.TransactionBuilder(
		new StellarSdk.Account(escrow.publicKey(), sequenceNumber),
		{
			timebounds: {
				minTime: unixRecovery,
				maxTime: 0
			}
		}
	)
		.addOperation(
			StellarSdk.Operation.setOptions({
				signer: {
					ed25519PublicKey: destination.publicKey(),
					weight: 0 //remove the destination account as a signer
				}
			})
		)
		.addOperation(
			StellarSdk.Operation.setOptions({
				signer: {
					ed25519PublicKey: source.publicKey(),
					weight: 1 //set source account can do anything
				}
			})
		)
		.addOperation(
			StellarSdk.Operation.setOptions({
				masterWeight: 0,
				lowThreshold: 1,
				medThreshold: 1,
				highThreshold: 1
			})
		)
		.build();
	transaction4.sign(StellarSdk.Keypair.fromSecret(escrow.secret()));
	transaction4.sign(StellarSdk.Keypair.fromSecret(destination.secret()));
	const source_envelope = transaction4.toEnvelope().toXDR('base64');

	console.log('source_envelope:', source_envelope);
	console.log('transaction4.sequence', transaction4.sequence);

	const remain_time = (unlockDate - new Date().getTime()) / 1000;
	console.log('remaining time ', remain_time);
	return { dest_envelope, source_envelope };
};

const sendToEscrow = async (escrow, source, amount) => {
	//can't submit this transaction for at least 5 minutes
	//both the source & destination need to sign this transaction, each hold a copy,
	//either can submit it at any point after the unlock period
	//A send tokens to escrow
	console.log('-----------------------------------------------------');
	console.log('------------------Transacation 5---------------------');
	console.log('-----------------------------------------------------');
	console.log('loading source account');
	const sourceAccount = await sscutils.loadAccount(source.publicKey());
	const transaction5 = new StellarSdk.TransactionBuilder(sourceAccount)
		.addOperation(
			StellarSdk.Operation.payment({
				destination: escrow.publicKey(),
				asset: StellarSdk.Asset.native(),
				amount: amount.toString() // in XLM
			})
		)
		.build();
	transaction5.sign(StellarSdk.Keypair.fromSecret(source.secret()));
	const receipt5 = await configs.server
		.submitTransaction(transaction5)
		.catch(err => {
			console.error('ERROR!', err);
		});
	console.log('receipt5', receipt5);
	console.log('-----------------------------------------------------');
};

const withdrawToDestination = async (
	tran_envelope,
	escrow,
	destination,
	amount
) => {
	// note: if transaction 4 is submitted by A source or escrow account
	// transaction 3 can not submit and return not found
	console.log('transaction envelope:', tran_envelope);
	const transaction = new StellarSdk.Transaction(tran_envelope);
	console.log('-----------------------------------------------------');
	console.log('----------------Submit Transacation 3----------------');
	console.log('-----------------------------------------------------');
	const receipt = await configs.server
		.submitTransaction(transaction)
		.catch(err => {
			console.error('ERROR!', err.data.extras.results_codes);
		});
	if (!receipt) {
		console.log('transaction not found');
		return;
	}
	console.log('-----------escrow signers---------------');
	await sscutils.showSigner(escrow.publicKey());

	console.log('-----------escrow balance---------------');
	const escrowAccount = await sscutils.loadAccount(escrow.publicKey());

	const withdrawTransaction = new StellarSdk.TransactionBuilder(escrowAccount)
		.addOperation(
			StellarSdk.Operation.payment({
				destination: destination.publicKey(),
				asset: StellarSdk.Asset.native(),
				amount: amount.toString() // 100.50 XLM
			})
		)
		.build();
	// only need B (destination account) signed
	withdrawTransaction.sign(StellarSdk.Keypair.fromSecret(destination.secret()));
	const withdrawReceipt = await configs.server
		.submitTransaction(withdrawTransaction)
		.catch(err => {
			console.error('ERROR!', err.data);
		});

	console.log(withdrawReceipt);
};

// OPTION 2
// use source account to make a payment to withdraw
const withdrawToSource = async (tran_envelope, escrow, source, amount) => {
	// note: if transaction 3 is submitted by B destination account
	// transaction 4 can not submit and return not found
	console.log('transaction envelope:', tran_envelope);
	const transaction = new StellarSdk.Transaction(tran_envelope);
	console.log('-----------------------------------------------------');
	console.log('----------------Submit Transacation 4----------------');
	console.log('-----------------------------------------------------');
	const receipt = await configs.server
		.submitTransaction(transaction)
		.catch(err => {
			console.error('ERROR!', err.data.extras.results_codes);
		});
	if (!receipt) {
		console.log('transaction not found');
		return;
	}

	console.log('-----------escrow signers status---------------');
	await sscutils.showSigner(escrow.publicKey());

	console.log('-----------escrow balance---------------');
	const escrowAccount = await sscutils.loadAccount(escrow.publicKey());

	const withdrawTransaction = new StellarSdk.TransactionBuilder(escrowAccount)
		.addOperation(
			StellarSdk.Operation.payment({
				destination: source.publicKey(),
				asset: StellarSdk.Asset.native(),
				amount: amount.toString() // 100.50 XLM
			})
		)
		.build();
	// only need B (destination account) signed
	withdrawTransaction.sign(StellarSdk.Keypair.fromSecret(source.secret()));
	const withdrawReceipt = await configs.server
		.submitTransaction(withdrawTransaction)
		.catch(err => {
			console.error('ERROR!', err.data);
		});

	console.log(withdrawReceipt);
};

main();
