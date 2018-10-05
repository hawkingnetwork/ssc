/*
 * Filename: /Users/naviocean/Working/HAWKING/ssc/configs.js
 * Path: /Users/naviocean/Working/HAWKING/ssc
 * Created Date: Tuesday, September 11th 2018, 9:56:52 am
 * Author: Navi Ocean
 *
 * Copyright (c) 2018 Hawking LLC
 */
require('dotenv').config();
const StellarSdk = require('stellar-sdk');
const isProduction = process.env.NODE_ENV === 'development' ? false : true;
let server;

if (isProduction) {
	console.log('production');
	server = new StellarSdk.Server('https://horizon.stellar.org');
	StellarSdk.Network.usePublicNetwork();
} else {
	console.log('development');
	server = new StellarSdk.Server('https://horizon-testnet.stellar.org');
	StellarSdk.Network.useTestNetwork();
}

module.exports = {
	issueAccount: {
		public: 'GB3GXQSSXC3T7UTLHQXXZTA34SCWCJN6ZDNFA2VWH6IU3OXGNQYJPMRG'
	},
	hawkingAccount: {
		public: 'GAGZP2FTOJC5NBF5NCPWSUPLFXQL256GKCWIBLX7ZKFKHOL2TECUR6OE',
		secret: 'SAZP2XLTJA7VVRX3TVTCC3E73U3AR2QKB75L3YOGZNCSRYLOY7GKLMOU'
	},
	server: server
};
