import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'

/* Same config as the original leads-dashboard.html */
const firebaseConfig = {
  apiKey: 'AIzaSyCIdpdd-fwOHonhY391V3dBEmlEd9QYgL4',
  authDomain: 'leads-d72d2.firebaseapp.com',
  databaseURL: 'https://leads-d72d2-default-rtdb.firebaseio.com',
  projectId: 'leads-d72d2',
  storageBucket: 'leads-d72d2.firebasestorage.app',
  messagingSenderId: '575397528490',
  appId: '1:575397528490:web:9d8244991f0f7a637c21d3',
  measurementId: 'G-WM7FQXF25Z',
}

const app = initializeApp(firebaseConfig)
export const db = getDatabase(app)
export const LEADS_COLLECTION = 'leads'
