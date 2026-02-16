import { db } from "../firebase.js";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const COL_MEMBERSHIPS = "memberships";
const COL_INSTALLMENTS = "membership_installments";

function norm(s) {
  return (s || "").toString().toLowerCase().trim();
}

function isSettled(st) {
  const s = norm(st || "pending");
  return s === "paid" || s === "validated";
}

/**
 * Recalcula y persiste rollup en memberships/{mid}
 * - installmentsTotal, installmentsSettled, installmentsPending
 * - nextUnpaidN, nextUnpaidDueDate
 */
export async function recomputeMembershipRollup(mid) {
  const q = query(collection(db, COL_INSTALLMENTS), where("membershipId", "==", mid));
  const snap = await getDocs(q);
  const inst = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  const total = inst.length;
  const settled = inst.filter(i => isSettled(i.status)).length;
  const pending = Math.max(0, total - settled);

  const next = inst
    .filter(i => !isSettled(i.status))
    .map(i => ({
      n: i.n ?? null,
      due: i.dueDate || (i.dueMonthDay ? `${i.season}-${i.dueMonthDay}` : null)
    }))
    .filter(x => !!x.due)
    .sort((a,b) => String(a.due).localeCompare(String(b.due)))[0] || null;

  const rollup = {
    installmentsTotal: total,
    installmentsSettled: settled,
    installmentsPending: pending,
    nextUnpaidN: next?.n ?? null,
    nextUnpaidDueDate: next?.due ?? null,
    updatedAt: serverTimestamp()
  };

  await updateDoc(doc(db, COL_MEMBERSHIPS, mid), rollup);
  return rollup;
}
