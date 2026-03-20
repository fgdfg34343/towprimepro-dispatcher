import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const cfg = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

if (!cfg.projectId) {
  console.error('Missing Firebase config in environment');
  process.exit(1);
}

const app = initializeApp(cfg);
const db = getFirestore(app);

const snapshot = await getDocs(collection(db, 'supportChats'));
console.log('Total docs:', snapshot.size);
snapshot.forEach((doc) => {
  const data = doc.data();
  console.log(doc.id, data?.driverName, data?.status, data?.isActive);
});
