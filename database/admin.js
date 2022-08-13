// require('dotenv').config();
import dotenv from 'dotenv';
dotenv.config();
import admin from 'firebase-admin';
// const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');

var serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL,
  databaseAuthVariableOverride: {
    uid: process.env.SECRET_DATABASE_UID
  } 
});

export default admin;