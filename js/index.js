const $ = q => document.querySelector(q);
const $$ = q => [...document.querySelectorAll(q)];

const START_BANK = 1000;
const SMALL_BLIND = 25;
const BIG_BLIND = 50;
const HAND_RANKS = [
	'green-5', 'teal-5', 'black-5', 'blue-5',
	'green-4', 'teal-4', 'black-4', 'blue-4',
	'green-3', 'teal-3', 'black-3', 'blue-3',
	'high-card'
];
const HAND_RANKS_MSGS = [
	'5 4+ Factors', '5 3-Factors', '5 Primes', '5 2-Factors',
	'4 4+ Factors', '4 3-Factors', '4 Primes', '4 2-Factors',
	'3 4+ Factors', '3 3-Factors', '3 Primes', '3 2-Factors',
	'High Card'
];

// Get number of factors for each card
const factors = [1, 1, 1];

for (let i=3; i<100; i++) {
	let num = i;
	let nf = 0;
	outer:
	for (let j=2; j<factors.length+1; j++) {
		while (num%j == 0) {
			nf += 1;
			num = num/j;
		}
		if (num == 1) {
			break;
		}
	}
	factors.push(nf);
}

// Get histogram of factors
/*const hist = [];

for (let i=0; i<factors.length; i++) {
	if (!hist[factors[i]]) {
		hist[factors[i]] = 1;
	} else {
		hist[factors[i]]++;
	}
}

console.log(hist);*/

// 0-99: cards 100: back
const cardImages = [];
const otherImages = {};
let cardImagesLoaded = 0;
let deck = [];
let flopTurnRiver = [];
let hands = [];
let globMessage = null;
let blindIdx = 0;
let callAmount = 0;
let curCaller = 0;
let lastCaller = 0;
let lastCallerWent = false;
let turnOver = false;
let playerHandRanks = [];
let playerHighestHands = [];
let winnerIdx = 0;

function getHandSortedHums(hand, flopTurnRiver) {
	const hums = [];
	for (let i=0; i<hand.cards.length; i++) {
		hums.push(hand.cards[i].hum);
	}
	for (let i=0; i<flopTurnRiver.length; i++) {
		if (flopTurnRiver[i]) {
			hums.push(flopTurnRiver[i].hum);
		}
	}
	hums.sort((a,b) => a > b);
	return hums;
}

function getFactors(hums, f) {
	const res = [];
	for (let i=0; i<hums.length; i++) {
		if (factors[hums[i]] == f) {
			res.push(hums[i]);
		}
	}
	return res;
}

// return true if arr1 has higher card than arr2
function higherCard(arr1, arr2) {
	for (let i=0; i<arr1.length && i<arr2.length; i++) {
		if (arr1[i] > arr2[i]) {
			return true;
		}
	}
	return false;
}

function getWinner(hands, flopTurnRiver) {
	for (let i=0; i<4; i++) {
		const hums = getHandSortedHums(hands[i], flopTurnRiver);
		const ones = getFactors(hums, 1);
		const twos = getFactors(hums, 2);
		const threes = getFactors(hums, 3);
		const fours = getFactors(hums, 4);
		const fives = getFactors(hums, 5);
		const sixes = getFactors(hums, 6);
		const foursPlus = [...fours, ...fives, ...sixes];
		foursPlus.sort((a,b) => a > b);
		const facts = [ones, twos, threes, foursPlus];
		let maxIdx = 0;
		let atLeastThree = false;
		for (let j=0; j<4; j++) {
			if (facts[j].length < 3) {
				continue;
			}
			if (facts[j].length >= facts[maxIdx].length) {
				maxIdx = j;
				atLeastThree = true;
			}
		}
		if (!atLeastThree) {
			playerHandRanks.push('high-card');
			playerHighestHands.push(hums);
		} else if (maxIdx == 0) {
			playerHandRanks.push('black-' + facts[maxIdx].length);
			playerHighestHands.push(facts[maxIdx]);
		} else if (maxIdx == 1) {
			playerHandRanks.push('blue-' + facts[maxIdx].length);
			playerHighestHands.push(facts[maxIdx]);
		} else if (maxIdx == 2) {
			playerHandRanks.push('teal-' + facts[maxIdx].length);
			playerHighestHands.push(facts[maxIdx]);
		} else {
			playerHandRanks.push('green-' + facts[maxIdx].length);
			playerHighestHands.push(facts[maxIdx]);
		}
	}
	let minIdx = 100;
	let minIdxPlayerIdx = 0;
	for (let i=0; i<4; i++) {
		for (let j=0; j<HAND_RANKS.length; j++) {
			if (playerHandRanks[i] == HAND_RANKS[j]) {
				if ((j < minIdx) || 
					(j == minIdx && 
						higherCard(playerHighestHands[i], playerHighestHands[minIdxPlayerIdx]))) {
					minIdx = j;
					minIdxPlayerIdx = i;
				}
			}
		}
	}
	return minIdxPlayerIdx;
}

class HandRankMessage {
	constructor(playerIdx) {
		this.playerIdx = playerIdx;
	}

	get msg() {
		for (let i=0; i<HAND_RANKS.length; i++) {
			if (playerHandRanks[this.playerIdx] == HAND_RANKS[i]) {
				return HAND_RANKS_MSGS[i];
			}
		}
	}

	draw(ctx) {
		ctx.font = '36px Sans';
		const tm = ctx.measureText(this.msg);
		const x = hands[this.playerIdx].loc-tm.width/2;
		const y = this.playerIdx == 0 ? 520 : 150;
		ctx.globalAlpha = 0.5;
		ctx.fillStyle = '#faa';
		ctx.fillRect(x-20, y-40, tm.width+40, 60);
		ctx.globalAlpha = 1;
		ctx.fillStyle = '#00f';
		ctx.fillText(this.msg, x, y);
		ctx.strokeStyle = '1px solid #33f';
		ctx.strokeRect(x-20, y-40, tm.width+40, 60);

		/*if (winnerIdx == this.playerIdx) {
			ctx.font = '48px Sans';
			const msg = 'Winner!';
			const tm = ctx.measureText(msg);
			const x = hands[this.playerIdx].loc-tm.width/2;
			const y = this.playerIdx == 0 ? 600 : 80;
			ctx.globalAlpha = 0.5;
			ctx.fillStyle = '#afa';
			ctx.fillRect(x-20, y-40, tm.width+40, 60);
			ctx.globalAlpha = 1;
			ctx.fillStyle = '#f00';
			ctx.fillText(msg, x, y);
			ctx.strokeStyle = '1px solid #33f';
			ctx.strokeRect(x-20, y-40, tm.width+40, 60);
		}*/
	}
}

class EndHandMessage {
	constructor() {
		this.p0 = new HandRankMessage(0);
		this.p1 = new HandRankMessage(1);
		this.p2 = new HandRankMessage(2);
		this.p3 = new HandRankMessage(3);
		const players = ['Player', 'Oppo 1', 'Oppo 2', 'Oppo 3'];
		this.winner = new Message(players[winnerIdx] + ' wins!');
		this.button = new Button(
			"Next Hand", 
			new Rect(80, 675, 200, 50),
			() => {
				globMessage = new Message("Next Hand", 1000, () => {
					beginTurn();
				});
			},

		);
		this.msgs = [this.p0, this.p1, this.p2, this.p3, this.winner, this.button];
	}
	
	click(p) {
		this.button.click(p);
	}

	draw(ctx) {
		for (let i=0; i<this.msgs.length; i++) {
			this.msgs[i].draw(ctx);
		}
	}


	mousemove(p) {
		this.button.mousemove(p);
	}

	mouseout() {
		this.button.mouseout();
	}
}

class Message {
	// time in milliseconds
	constructor(msg, time, cb) {
		this.msg = msg;
		this.time = time ?? null;
		if (this.time) {
			setTimeout(() => {
				globMessage = null;
				if (cb) {
					cb();
				}
			}, this.time);
		}
	}

	draw(ctx) {
		const canvas = $('#hunniker-canvas');
		ctx.save();
		ctx.fillStyle = '#aaf';
		ctx.globalAlpha = 0.5;
		ctx.fillRect(20, canvas.height/2-50, canvas.width-40, 100);
		ctx.globalAlpha = 1;
		ctx.strokeStyle = '1px solid #33f';
		ctx.strokeRect(20, canvas.height/2-50, canvas.width-40, 100);
		ctx.fillStyle = '#33f';
		ctx.font = '64px Sans';
		const tm = ctx.measureText(this.msg);
		ctx.fillText(this.msg, canvas.width/2 - tm.width/2, canvas.height/2 + 20);
	}
}

class Rect {
	constructor(x, y, w, h) {
		this.x = x;
		this.y = y;
		this.w = w;
		this.h = h;
	}

	contains(p) {
		if (p.x < this.x || p.x > this.x + this.w) {
			return false;
		}
		if (p.y < this.y || p.y > this.y + this.h) {
			return false;
		}
		return true;
	}
}

// For convenience these are a separate class from a hand card (just Card)
class FlopTurnRiverCard {
	constructor(cx, cy, hum, which) {
		this.cx = cx;
		this.cy = cy;
		this.hum = hum;
		this.w = 150;
		this.which = which; // flop turn or river
	}

	get rect() {
		let image = cardImages[this.hum];
		if (!image) {
			return;
		}
		const aspRatio = image.height / image.width;
		const h = this.w * aspRatio;
		const x = this.cx - this.w/2;
		const y = this.cy - h/2;
		return new Rect(x, y, this.w, h);
	}

	draw(ctx) {
		let image = cardImages[this.hum];
		if (!image) {
			return;
		}
		const rect = this.rect;
		ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h);
		ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
		ctx.font = '24px Sans';
		const tm = ctx.measureText(this.which);
		ctx.fillText(this.which, this.cx - tm.width/2, this.cy - 120);
	}
}

class Card {
	// cx and cy determined in packCards()
	constructor(hum, hand) {
		this.hum = hum;
		this.w = 150;
		this.hand = hand;
	}

	draw(ctx) {
		let image = cardImages[this.hum];
		if (this.hand.inv && !turnOver) {
			image = cardImages[100];
		}
		// Image not loaded yet
		if (!image) {
			return;
		}
		const rect = this.rect;
		ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h);
		ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
	}

	get rect() {
		let image = cardImages[this.hum];
		if (this.hand.inv) {
			image = cardImages[100];
		}
		if (!image) {
			return;
		}
		const aspRatio = image.height / image.width;
		const h = this.w * aspRatio;
		let x,y;
		if (this.hand.inv) {
			x = this.cx - this.w/2;
			y = this.cy - h/3;
		} else {
			x = this.cx - this.w/2;
			y = this.cy - h - 5;
		}
		return new Rect(x, y, this.w, h);
	}

	mousemove(p) {
		if (this.rect.contains(p)) {
			this.w = 180;
		} else {
			this.w = 150;
		}
	}

	mouseout(p) {
		this.w = 150;
	}
}

class Hand {
	// loc: point on the edge of the canvas where cards are centered
	// inv: whether the hand is displayed on the bottom (false) or on top (true, opponents)
	constructor(loc, inv, name, bank) {
		this.loc = loc;
		this.inv = inv;
		this.cards = [];
		this.name = name;
		this.bank = bank;
	}

	draw(ctx) {
		if (!this.fold) {
			for (let i=0; i<this.cards.length; i++) {
				this.cards[i].draw(ctx);
			}
		}

		// Draw name, bank, current bid
		const canvas = $('#hunniker-canvas');
		if (this.inv) {
			const namx = this.loc - 100;
			const namy = 175;
			ctx.fillStyle = 'black';
			ctx.font = '24px Sans';
			ctx.fillText(this.name, namx, namy);
			if (otherImages['bank']) {
				const bankx = this.loc - 100;
				const banky = 205;
				ctx.fillText(this.bank, bankx, banky);
				const bankimgx = this.loc - 155;
				const bankimgy = 180;
				ctx.drawImage(otherImages['bank'], bankimgx, bankimgy, 
					otherImages['bank'].width/5, otherImages['bank'].height/5);
			}
			if (otherImages['bid'] && this.bid) {
				const bidx = this.loc + 50;
				const bidy = 205;
				ctx.fillText(this.bid, bidx, bidy);
				const bidimgx = this.loc + 10;
				const bidimgy = 185;
				ctx.drawImage(otherImages['bid'], bidimgx, bidimgy, 
					otherImages['bid'].width/4.5, otherImages['bid'].height/4.5);
			}
		} else {
			ctx.fillStyle = 'black';
			ctx.font = '24px Sans';
			// Special drawing place for player bank and current bid
			if (otherImages['bank']) {
				const bankx = this.loc + 260;
				const banky = canvas.height - 25;
				ctx.fillText(this.bank, bankx, banky);
				const bankimgx = this.loc + 200;
				const bankimgy = canvas.height - 50;
				ctx.drawImage(otherImages['bank'], bankimgx, bankimgy, 
					otherImages['bank'].width/5, otherImages['bank'].height/5);
			}
			if (otherImages['bid'] && this.bid) {
				const bidx = this.loc + 405;
				const bidy = canvas.height - 25;
				ctx.fillText(this.bid, bidx, bidy);
				const bidimgx = this.loc + 360;
				const bidimgy = canvas.height - 45;
				ctx.drawImage(otherImages['bid'], bidimgx, bidimgy, 
					otherImages['bid'].width/4.5, otherImages['bid'].height/4.5);
			}
		}
	}

	packCards() {
		const canvas = $('#hunniker-canvas');
		const tw = this.cards[0].w + 5 + this.cards[1].w;
		this.cards[0].cx = this.loc - tw/2 + this.cards[0].w/2;
		this.cards[1].cx = this.loc + tw/2 - this.cards[1].w/2;
		this.cards[0].cy = this.inv ? -20 : canvas.height;
		this.cards[1].cy = this.inv ? -20 : canvas.height;
	}
}

function shuffle(arr) {
	for (let i=0; i<arr.length; i++) {
		const j = Math.floor(Math.random()*arr.length);
		const tmp = arr[i];
		arr[i] = arr[j];
		arr[j] = tmp;
	}
}

function deal(hands) {
	deck = [...Array(100).keys()];
	shuffle(deck);
	for (let i=0; i<hands.length; i++) {
		hands[i].cards = [];
		if (hands[i].bank == 0) {
			continue;
		}
		hands[i].cards.push(new Card(deck.pop(), hands[i]));
		hands[i].cards.push(new Card(deck.pop(), hands[i]));
		hands[i].packCards();
	}
	flopTurnRiver = [null, null, null];
}

function smallBlindFn() {
	while (hands[blindIdx].bank == 0) {
		blindIdx++;
		if (blindIdx > 3) {
			blindIdx = 0;
		}
	}
	const bank = hands[blindIdx].bank;
	const bid = bank < SMALL_BLIND ? bank : SMALL_BLIND;
	hands[blindIdx].bank -= bid;
	hands[blindIdx].bid = bid;
	blindIdx++;
	if (blindIdx > 3) {
		blindIdx = 0;
	}
	setTimeout(() => {
		globMessage = new Message('Big Blind', 1000, bigBlindFn);
	}, 500);
}

function bigBlindFn() {
	while (hands[blindIdx].bank == 0) {
		blindIdx++;
		if (blindIdx > 3) {
			blindIdx = 0;
		}
	}
	const bank = hands[blindIdx].bank;
	const bid = bank < BIG_BLIND ? bank : BIG_BLIND;
	hands[blindIdx].bank -= bid;
	hands[blindIdx].bid = bid;
	callAmount = bid;
	// Who has the last word on fold/stay/call/raise
	curCaller = (blindIdx+1)%4;
	lastCaller = blindIdx;
	lastCallerWent = false;
	setTimeout(() => {
		callBetLoop();
	}, 1000);
}

function callBetLoop() {
	if (curCaller == (lastCaller+1)%4 && lastCallerWent) {
		doFlopTurnRiverEnd();
	} else {
		// Have to do some gymnastics here
		// lastCaller and lastCallerWent modified in oppoChoice and playerChoice on raise
		if (curCaller == lastCaller) {
			lastCallerWent = true;
		}
		if (hands[curCaller].fold || hands[curCaller].bank == 0) {
			// continue over deadbeats
			curCaller = (curCaller+1)%4;
			callBetLoop();
		} else if (curCaller == 0) {
			// async via callback, breaks up stack usage
			curCaller = 1;
			playerChoice();
		} else {
			oppoChoice(curCaller);
			curCaller = (curCaller+1)%4;
		}
	}
}

function doFlopTurnRiverEnd() {
	const canvas = $('#hunniker-canvas');
	if (!flopTurnRiver[0]) {
		globMessage = new Message('Flop', 2000, () => {
			flopTurnRiver[0] = 
				new FlopTurnRiverCard(canvas.width/2 - 160, canvas.height/2, deck.pop(), 'Flop');
			lastCallerWent = false;
			callBetLoop();
		});
	} else if (!flopTurnRiver[1]) {
		globMessage = new Message('Turn', 2000, () => {
			flopTurnRiver[1] =
				new FlopTurnRiverCard(canvas.width/2, canvas.height/2, deck.pop(), 'Turn');
			lastCallerWent = false;
			callBetLoop();
		});
	} else if (!flopTurnRiver[2]) {
		globMessage = new Message('River', 2000, () => {
			flopTurnRiver[2] =
				new FlopTurnRiverCard(canvas.width/2 + 160, canvas.height/2, deck.pop(), 'River');
			lastCallerWent = false;
			callBetLoop();
		});
	} else {
		turnOver = true;
		winnerIdx = getWinner(hands, flopTurnRiver);
		let bank = 0;
		for (let i=0; i<4; i++) {
			bank += hands[i].bid;
			hands[i].bid = 0;
		}
		hands[winnerIdx].bank += bank;
		globMessage = new EndHandMessage();
	}
}

class Button {
	constructor(msg, rect, cb) {
		this.msg = msg;
		this.rect = rect;
		this.cb = cb;
		this.highlight = false;
		this.disabled = false;
	}

	click(p) {
		if (this.rect.contains(p) && this.cb && !this.disabled) {
			this.cb();	
		}
	}

	draw(ctx) {
		ctx.font = '36px Sans';
		if (this.disabled) {
			ctx.globalAlpha = 0.3;
		}
		if (this.highlight && !this.disabled) {
			ctx.strokeStyle = '1px solid #aaf';
			ctx.fillStyle = '#33f';
			ctx.fillRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h);
			ctx.strokeRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h);
			ctx.fillStyle = '#fff';
			const tm = ctx.measureText(this.msg);
			ctx.fillText(this.msg, this.rect.x+this.rect.w/2-tm.width/2, this.rect.y+this.rect.h-13);
		} else {
			ctx.strokeStyle = '1px solid #33f';
			ctx.fillStyle = '#aaf';
			ctx.fillRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h);
			ctx.strokeRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h);
			ctx.fillStyle = '#339';
			const tm = ctx.measureText(this.msg);
			ctx.fillText(this.msg, this.rect.x+this.rect.w/2-tm.width/2, this.rect.y+this.rect.h-13);
		}
		ctx.globalAlpha = 1;
	}

	mousemove(p) {
		this.highlight = this.rect.contains(p);
	}

	mouseout() {
		this.highlight = false;
	}
}

class PlayerBidMessage {
	constructor() {
		this.foldButton = new Button(
			"Fold",
			new Rect(80, 675, 200, 50),
			() => {
				hands[0].fold = true;
				globMessage = new Message("Player folds!", 1000, () => {
					lastCaller = 0;
					callBetLoop();
				});
			},
		);
		this.foldButton.disabled = callAmount <= hands[0].bid;
		this.stayButton = new Button(
			"Stay",
			new Rect(80, 615, 200, 50),
			() => {
				globMessage = new Message('Player stays!', 1000, () => {
					callBetLoop();
				});
			},
		);
		this.stayButton.disabled = callAmount != hands[0].bid && hands[0].bank > 0;
		let callInc = callAmount - hands[0].bid;
		if (callInc > hands[0].bank) {
			callInc = hands[0].bank;
		}
		this.callButton = new Button(
			"Call " + callInc,
			new Rect(80, 555, 200, 50),
			() => {
				hands[0].bank -= callInc;
				hands[0].bid += callInc;
				globMessage = new Message('Player calls ' + callInc + '!', 1000, () => {
					callBetLoop();
				});
			},
		);
		this.callButton.disabled = callInc == 0;
		const raiseSmallInc = callInc + 50;
		this.raiseSmallButton = new Button(
			"Raise " + raiseSmallInc,
			new Rect(80, 495, 200, 50),
			() => {
				hands[0].bank -= raiseSmallInc;
				hands[0].bid += raiseSmallInc;
				lastCaller = 0;
				lastCallerWent = false;
				callAmount = hands[0].bid;
				globMessage = new Message('Player raises ' + raiseSmallInc + '!', 1000, () => {
					callBetLoop();
				});
			},
		);
		this.raiseSmallButton.disabled = raiseSmallInc > hands[0].bank;
		const raiseBigInc = callInc + 200;
		this.raiseBigButton = new Button(
			"Raise " + raiseBigInc,
			new Rect(80, 435, 200, 50),
			() => {
				hands[0].bank -= raiseBigInc;
				hands[0].bid += raiseBigInc;
				lastCaller = 0;
				lastCallerWent = false;
				callAmount = hands[0].bid;
				globMessage = new Message('Player raises ' + raiseBigInc + '!', 1000, () => {
					callBetLoop();
				});
			},
		);
		this.raiseBigButton.disabled = raiseBigInc > hands[0].bank;
		this.allInButton = new Button(
			"All in!",
			new Rect(80, 375, 200, 50),
			() => {
				hands[0].bid += hands[0].bank;
				hands[0].bank = 0;
				lastCaller = 0;
				lastCallerWent = false;
				callAmount = hands[0].bid;
				globMessage = new Message('Player goes all in!', 1000, () => {
					callBetLoop();
				});
			},
		);
		this.allInButton.disabled = hands[0].bank == 0;
		this.buttons = [this.foldButton, this.stayButton, this.callButton, 
			this.raiseSmallButton, this.raiseBigButton, this.allInButton];
	}

	click(p) {
		for (let i=0; i<this.buttons.length; i++) {
			if (this.buttons[i]) {
				this.buttons[i].click(p);
			}
		}
	}

	draw(ctx) {
		for (let i=0; i<this.buttons.length; i++) {
			if (this.buttons[i]) {
				this.buttons[i].draw(ctx);
			}
		}
	}

	mousemove(p) {
		for (let i=0; i<this.buttons.length; i++) {
			if (this.buttons[i]) {
				this.buttons[i].mousemove(p);
			}
		}
	}

	mouseout() {
		for (let i=0; i<this.buttons.length; i++) {
			if (this.buttons[i]) {
				this.buttons[i].mouseout();
			}
		}
	}
}

function playerChoice() {
	globMessage = new PlayerBidMessage();
}

function oppoChoice(idx) {
	let msg;
	// Always stay
	if (hands[idx].bank == 0 || hands[idx].bid == callAmount) {
		msg = "Stay";
	// Always call
	} else {
		const inc = callAmount - hands[idx].bid;
		const bid = hands[idx].bank > inc ? inc : hands[idx].bank;
		hands[idx].bank -= bid;
		hands[idx].bid += bid;
		msg = "Call";
	}
	globMessage = new Message(hands[idx].name + " " + msg, 1000, callBetLoop);
}

function beginTurn() {
	const canvas = $('#hunniker-canvas');
	// Init hands
	for (let i=0; i<4; i++) {
		hands[i].fold = false;
	}
	turnOver = false;
	playerHandRanks = [];
	playerHighestHands = [];
	globMessage = new Message('Deal Hand', 1000, () => {
		deal(hands);
		// Pay blinds
		globMessage = new Message('Small Blind', 1000, smallBlindFn);
	});
}

// We don't care about the rate of redraw, as long as it's fast enough
function animate(ts) {
	const canvas = $('#hunniker-canvas');
	const ctx = canvas.getContext('2d');

	// Clear canvas
	ctx.fillStyle = 'white';
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	// Draw hands
	for (let i=0; i<hands.length; i++) {
		hands[i].draw(ctx);
	}

	// Draw flop turn river
	for (let i=0; i<flopTurnRiver.length; i++) {
		if (flopTurnRiver[i]) {
			flopTurnRiver[i].draw(ctx);
		}
	}

	// Draw message
	if (globMessage) {
		globMessage.draw(ctx);
	}

	requestAnimationFrame(animate);
}

window.addEventListener('load', e => {
	const canvas = $('#hunniker-canvas');

	// load cards
	for (let i=0; i<100; i++) {
		const img = new Image();
		img.src = 'image/cards/' + i + '.png';
		img.addEventListener('load', e => {
			cardImages[i] = img;
			cardImagesLoaded++;
		});
	}
	const back = new Image();
	back.src = 'image/cards/back.png';
	back.addEventListener('load', e => {
		cardImages[100] = back;
		cardImagesLoaded++;
	});

	// load other images
	const bankImg = new Image();
	bankImg.src = 'image/bank.png';
	bankImg.addEventListener('load', e => {
		otherImages['bank'] = bankImg;
	});
	const bidImg = new Image();
	bidImg.src = 'image/bid.png';
	bidImg.addEventListener('load', e => {
		otherImages['bid'] = bidImg;
	});

	const player = new Hand(canvas.width/2, false, "Player", START_BANK);
	hands.push(player);

	const oppLeft = new Hand(canvas.width/4-100, true, "Oppo 1", START_BANK);
	const oppMid = new Hand(2*canvas.width/4, true, "Oppo 2", START_BANK);
	const oppRight = new Hand(3*canvas.width/4+100, true, "Oppo 3", START_BANK);
	hands.push(oppLeft);
	hands.push(oppMid);
	hands.push(oppRight);

	requestAnimationFrame(animate);

	// blow up cards
	// highlight buttons
	canvas.addEventListener('mousemove', e => {
		const p = {x: e.offsetX, y: e.offsetY};
		for (let i=0; i<hands.length; i++) {
			const cards = hands[i].cards;
			for (let j=0; j<cards.length; j++) {
				cards[j].mousemove(p);
				hands[i].packCards();
			}
		}
		if (globMessage && globMessage.mousemove) {
			globMessage.mousemove(p);
		}
	});

	canvas.addEventListener('mouseout', e => {
		for (let i=0; i<hands.length; i++) {
			const cards = hands[i].cards;
			for (let j=0; j<cards.length; j++) {
				cards[j].mouseout();
				hands[i].packCards();
			}
		}
		if (globMessage && globMessage.mouseout) {
			globMessage.mouseout();
		}
	});

	// click buttons
	canvas.addEventListener('click', e => {
		const p = {x: e.offsetX, y: e.offsetY};
		if (globMessage && globMessage.click) {
			globMessage.click(p);
		}
	});

	globMessage = new Message('Welcome to Hunniker!', 2000, () => {
		beginTurn();
	});
});

/*const h = new Hand();
h.cards.push(new Card(2));
h.cards.push(new Card(5));
h.cards.push(new Card(25));
h.cards.push(new Card(7));
h.cards.push(new Card(14));

const [rank, hc] = getHandValue(h, flopTurnRiver);
console.log(HAND_RANKS[rank], hc);*/
