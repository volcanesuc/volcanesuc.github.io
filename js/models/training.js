export class Training {
  constructor(id, data = {}) {
    this.id = id;                 // "2025-02-01"
    this.date = data.date ?? id;
    this.month = data.month ?? this.date.slice(0, 7);
    this.attendees = data.attendees ?? [];
    this.active = data.active ?? true;
    this.createdAt = data.createdAt ?? Date.now();
  }

  get count() {
    return this.attendees.length;
  }

  togglePlayer(playerId) {
    if (this.attendees.includes(playerId)) {
      this.attendees = this.attendees.filter(id => id !== playerId);
    } else {
      this.attendees.push(playerId);
    }
  }

  toFirestore() {
    return {
      date: this.date,
      month: this.month,
      attendees: this.attendees,
      active: this.active,
      createdAt: this.createdAt
    };
  }
}