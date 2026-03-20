import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import fs from "fs";

const parsedEnv = fs.readFileSync("../.env.local", "utf-8")
    .split('\n')
    .reduce((acc, line) => {
        const [key, ...val] = line.split('=');
        if (key) acc[key.trim()] = val.join('=').trim().replace(/"/g, '');
        return acc;
    }, {});

const firebaseConfig = {
    apiKey: parsedEnv.VITE_FIREBASE_API_KEY,
    authDomain: parsedEnv.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: parsedEnv.VITE_FIREBASE_PROJECT_ID,
    storageBucket: parsedEnv.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: parsedEnv.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: parsedEnv.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
    const snapshot = await getDocs(collection(db, "supportChats"));
    const data = [];
    snapshot.forEach(doc => {
        data.push({ id: doc.id, unreadByDispatcher: doc.data().unreadByDispatcher, unreadCount: doc.data().unreadCount, lastMessageFrom: doc.data().lastMessageFrom, status: doc.data().status, lastMessage: doc.data().lastMessage });
    });
    console.log(JSON.stringify(data, null, 2));
    process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
