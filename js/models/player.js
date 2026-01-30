// js/models/player.js

export class Player {
  constructor(id, data = {}) {
    this.id = id;

    this.firstName = data.firstName ?? "";
    this.lastName = data.lastName ?? "";
    this.number = data.number ?? null;
    this.gender = data.gender ?? null;
    this.birthday = data.birthday ?? null;
    this.active = data.active ?? true;
  }

  /* =========================
     DERIVED FIELDS
  ========================= */

  get fullName() {
    const name = `${this.firstName} ${this.lastName}`.trim();
    return name || "—";
  }

  get shortName() {
    return this.lastName
      ? `${this.firstName} ${this.lastName[0]}.`
      : this.firstName || "—";
  }

  /* =========================
     SERIALIZATION
  ========================= */

  toFirestore() {
    return {
      firstName: this.firstName,
      lastName: this.lastName,
      number: this.number,
      gender: this.gender,
      birthday: this.birthday,
      active: this.active
    };
  }

  static fromFirestore(doc) {
    return new Player(doc.id, doc.data());
  }
}
