import { Training } from "./models/training.js";
import { doc, setDoc } from "firebase/firestore";

async function saveTraining(training) {
  const ref = doc(db, "club_trainings", training.id);
  await setDoc(ref, training.toFirestore());
}

//load players on checklist

playersSnap.forEach(d => {
  players[d.id] = {
    id: d.id,
    name: `${d.data().firstName} ${d.data().lastName}`,
    number: d.data().number,
    active: d.data().active
  };
});