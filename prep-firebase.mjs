import { readFileSync, writeFileSync } from "fs";

const code = readFileSync("src/firebaseConfig.ts", "utf-8");
const match = code.match(/const firebaseConfig = ({[\s\S]*?});/);
if (match) {
    let configStr = match[1];
    // Some env variables might be used, e.g. import.meta.env.VITE_FIREBASE_API_KEY
    configStr = configStr.replace(/import\.meta\.env\.VITE_([A-Za-z0-9_]+)/g, "process.env.VITE_$1");
    
    const script = `
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import 'dotenv/config';

const firebaseConfig = ${configStr};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
    const snapshot = await getDocs(collection(db, "supportChats"));
    const data = [];
    snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() });
    });
    console.log(JSON.stringify(data.slice(0, 5), null, 2));
    process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
`;
    writeFileSync("test-firebase.mjs", script);
}
