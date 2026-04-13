import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCj6Q8eWBiiBXOx_7vOICzGHjBSDYFNV2Q",
  databaseURL: "https://golpe-63ee3-default-rtdb.firebaseio.com",
  projectId: "golpe-63ee3",
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
