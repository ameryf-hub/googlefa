// src/authUtils.js
import { getAuth, signOut } from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";

export async function checkAuthorization(user) {
  const db = getFirestore();
  const userRef = doc(db, "authorizedUsers", user.email);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    const auth = getAuth();
    await signOut(auth);
    alert("You are not authorized to access this application.");
    return false; // Not authorized
  }
  
  return true; // Authorized
}