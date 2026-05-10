import { MARINE_LIFE_DATABASE } from './src/constants/marineLife';

function oldWay(sp: string) {
    return MARINE_LIFE_DATABASE.find(s => s.toLowerCase() === sp.toLowerCase()) || sp;
}

const map = new Map(MARINE_LIFE_DATABASE.map(s => [s.toLowerCase(), s]));

function newWay(sp: string) {
    const lower = sp.toLowerCase();
    return map.get(lower) || sp;
}

const testCases = [
    "Shark",
    "shark",
    "Giant Trevally (GT)",
    "not in db",
    "bLue WHALE"
];

// Generate a lot of data
const data: string[] = [];
for (let i = 0; i < 100000; i++) {
    data.push(testCases[i % testCases.length]);
}

console.log("Warming up...");
for (const item of data) {
    oldWay(item);
    newWay(item);
}

console.log("Running benchmarks...");

const start1 = performance.now();
for (const item of data) {
    oldWay(item);
}
const end1 = performance.now();
console.log(`Old way: ${end1 - start1} ms`);

const start2 = performance.now();
for (const item of data) {
    newWay(item);
}
const end2 = performance.now();
console.log(`New way: ${end2 - start2} ms`);
