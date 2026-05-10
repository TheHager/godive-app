export const RANKS = [
  { min: 0, title: "Coastal Wanderer", status: "Rookie", nextGoal: "Reef Guardian", cert: "Open Water Diver", desc: "Just starting to feel at home in the waves." },
  { min: 3, title: "Reef Guardian", status: "Explorer", nextGoal: "Island Hopper", cert: "Advanced Open Water", desc: "A reliable presence in shallow and mid-range waters." },
  { min: 6, title: "Island Hopper", status: "Pathfinder", nextGoal: "Oceanic Sentinel", cert: "Rescue Diver", desc: "Mastering the currents and discovering distant horizons." },
  { min: 10, title: "Oceanic Sentinel", status: "Protector", nextGoal: "Deep Sea Voyager", cert: "Master Scuba Diver", desc: "A guardian who knows the rhythms of the deep." },
  { min: 15, title: "Deep Sea Voyager", status: "Specialist", nextGoal: "Abyssal Master", cert: "Divemaster", desc: "One of the few who regularly ventures into the twilight zone." },
  { min: 25, title: "Abyssal Master", status: "Elite", nextGoal: "Leviathan's Peer", cert: "Master Instructor", desc: "Possesses a knowledge of the abyss that few can claim." },
  { min: 50, title: "Leviathan's Peer", status: "Mythic", nextGoal: "Oceanic Oracle", cert: "Course Director", desc: "The ocean no longer feels like a visit; it feels like home." },
  { min: 65, title: "Oceanic Oracle", status: "Legend", nextGoal: "Soul of the Sea", cert: "Course Director", desc: "Possesses knowledge of the deep that few can comprehend." },
  { min: 80, title: "Soul of the Sea", status: "Immortal", nextGoal: "The Blue Eternal", cert: "Course Director", desc: "The boundary between human and water has vanished." },
  { min: 100, title: "The Blue Eternal", status: "Deity", nextGoal: "None", cert: "Course Director", desc: "The ultimate guardian of the world beneath the waves." },
];

export const calculateLevel = (xp: number) => {
  const validXp = Math.max(0, xp || 0);
  return Math.floor(Math.pow(validXp / 100, 0.5)) + 1;
};

export const getRankInfo = (level: number) => {
  const current = [...RANKS].reverse().find(r => level >= r.min) || RANKS[0];
  const next = RANKS[RANKS.indexOf(current) + 1] || current;
  return { ...current, nextCert: next.cert };
};
