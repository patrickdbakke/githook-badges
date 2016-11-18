require('colors')
const fs = require('fs')
const cheerio = require('cheerio')
const config = JSON.parse(fs.readFileSync('badges.json', 'utf8'))
const badges = config.badges
const README = config.readme || './README.md';
const readme = fs.readFileSync(README, 'utf8')
let $ = cheerio.load(readme)

const colors = [
	'red',
	'orange',
	'yellow',
	'yellowgreen',
	'green',
	'brightgreen',
]

const badgeString = (left, right, color) => {
	return `https://img.shields.io/badge/${left}-${right}-${color}.svg`
}

const getRegexMatches = (string, regexString, index = 1) => {
  let matches = [], match
  const regex = new RegExp(regexString, 'g');
  while (match = regex.exec(string)) {
    matches.push(match[index])
  }
  return matches
}

const getJSONMatches = (json, path) => {
	const obj = JSON.parse(json)
    return path.split('.').reduce(function(prev, curr) {
        return prev ? prev[curr] : undefined
    }, obj)
}

const getColor = (val, thresholds) => {
	if (typeof val === 'undefined' || val === null) {
		return 'red'
	}
	if(thresholds[0] < thresholds[thresholds.length - 1]){
		thresholds[0] = -999999999
		thresholds[thresholds.length -1] = 999999999
	} else {
		thresholds[0] = 999999999
		thresholds[thresholds.length -1] = -999999999
	}
	let color
	thresholds.forEach((min, index) => {
		if(!color && index === thresholds.length - 1 || between(val, min, thresholds[index + 1])){
			color = colors[index]
		}
	})
	return color
}

const between = function(val, a, b) {
  const min = Math.min(a, b),
  		max = Math.max(a, b)

  return val >= min && val < max
}

const getBadge = (badge, fn) => {
	const file = fs.readFileSync(badge.file, 'utf8')
	let value, text, unit = ''
	if (badge.pass && badge.fail) {
		const pass = +fn(file, badge.pass)[0]
		const fail = +fn(file, badge.fail)[0] || 0
		value = (pass / (pass + fail)) * 100
		text = pass + '/' + (pass + fail)
	} else if (badge.total && badge.count) {
		const total = +fn(file, badge.total)[0]
		const count = +fn(file, badge.count)[0]
		value = Math.floor((count / total) * 100)
		text = value + '%'
	} else if (badge.percent) {
		value = +fn(file, badge.percent)
		text = value + '%'
	} else if (badge.count) {
		text = value = +fn(file, badge.count)
	} else if (badge.value) {
		text = value = fn(file, badge.value)
	}
	const color = badge.color || getColor(value, badge.thresholds)
	const src = badgeString(badge.name, text, color)
	const elem = `<span id="badge-${badge.name}"><img src="${src}"/> </span>`
	return elem
}

let errors = false
badges.forEach((badge) => {
	let fn
	switch(badge.type){
		case 'regex':
			fn = getRegexMatches
			break
		case 'json':
			fn = getJSONMatches
			break

	}
	try {
		const newBadge = getBadge(badge, fn)
		if (newBadge) {
			let old = $(`#badge-${badge.name}`)
			if (old.length > 0) {
				old.replaceWith(newBadge)
			} else {
				$('#badges').append(newBadge)
			}
		}
	} catch (e){
		console.log(e)
		errors = true
	}
})

if (!errors) {
	fs.writeFileSync(README, $.html())
	console.log('Updating badges'.green)
}