export class Training {
  constructor(id = null, data = {}) {
    this.id = id;
    this.date = data.date;
    this.month = data.month ?? this.date?.slice(0, 7);
    this.attendees = data.attendees ?? [];
    this.summary = data.summary ?? "";
    this.notes = data.notes ?? "";
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
      summary: this.summary,
      notes: this.notes,
      active: this.active,
      createdAt: this.createdAt
    };
  }
}
