var moment = require('moment');
var request = require('request');
request = request.defaults({jar: true});
const cheerio = require('cheerio');

var URL = {
	cookie: "http://webapp.pucrs.br/bcrenovacao/Login?uid=000",
	index: "http://biblioteca.pucrs.br/renovacao/",
	login: function (user, password) {
		return "http://webapp.pucrs.br/bcrenovacao/servlet/br.pucrs.renovacao.ctrl.ValidaUsuarioId?idAppOrigem=21&idCategoria=42&cdMatricula="+user+"&txSenha="+password;
	},
	renew: function (user) {
		return "http://webapp.pucrs.br/bcrenovacao/servlet/br.pucrs.renovacao.ctrl.RenovLivrosId?usuario="+user;
	}
}

var args = process.argv;
var userId = args[2];
if (userId == undefined) {
	console.log("Informe Identificação. Algo errado não está certo.");
	return -1;
}
var userPassword = args[3];
if (userPassword == undefined) {
	console.log("Senha não pode ser lida. Algo errado não está certo.");
	return -1;
}

getCookie();

function getCookie() {
	console.log('Buscando cookie da sessão...');
	request(URL.cookie, function (error, response, body) {
		if (error != undefined || response.statusCode != 200) {
			console.log('error:', error);
			console.log('statusCode:', response && response.statusCode);
			return;
		}
		login();
	});
}

function login() {
	console.log("Realizando LOGIN. Id: "+userId+" - Senha: "+userPassword);
	request(URL.login(userId, userPassword), function (error, response, body) {
		if (error != undefined || response.statusCode != 200) {
			console.log('error:', error);
			console.log('statusCode:', response && response.statusCode);
			return;
		}
		renew();
	});
}

function renew() {
	console.log("Renovando Todos.");
	request(URL.renew(userId), function (error, response, body) {
		if (error != undefined || response.statusCode != 200) {
			console.log('error:', error);
			console.log('statusCode:', response && response.statusCode);
			return;
		}
		findBooks(body);
	});
}

function findBooks(html) {
	const didRenewPageHandler = cheerio.load(html);
	var books = getBooksWithHandler(didRenewPageHandler);
	console.log("LIVROS: "+books.length);
	if (books.length == 0) {return;}
	// console.log(books);
	console.log("Checando Status");
	for (var i=0; i < books.length; i += 1) {
		checkBookStatus(books[i]);
	}
}

function checkBookStatus(book) {
	console.log("\n\n"+book.title);
	var daysLeft = book.returnDate.diff(moment(), 'days');
	console.log("Dias restantes: "+daysLeft);
}

function getBooksWithHandler($) {
	console.log("Buscando por livros.");
	var table = getTableWithHandler($);
	if (table == undefined) { 
		console.log("NÃO encontrou livros.");
		return [];
	}
	return booksFromTableWithHandler(table, $);
}

function getTableWithHandler($) {
	var foundTable = undefined;
	$('table').each(function(i, table) {
		var isBooksTable = false;
		$(table).find('td').each(function(j, td) {
			//faz o || pra evitar setar pra falso de volta
			isBooksTable = isBooksTable || ($(td).text().replace(/ /g,'') == "Exemplar");
			isBooksTable = isBooksTable || ($(td).text().replace(/ /g,'') == "Título");
		});
		if (isBooksTable) {
			foundTable = table;
		}
	});
	return foundTable;
}

function bookFromRow(row, $) {
	var book = {};
	var cells = $(row).find('td');
	book.statusCaption = $(cells[0]).text();
	book.title = $(cells[1]).text();
	book.returnDate = moment($(cells[3]).text().replace(/ /g,''),'D/M/YYYY');
	if (book.title == "" || book.title == undefined) { return undefined; }
	if (book.returnDate == "" || book.returnDate == undefined) { return undefined; }
	return book;
}

function booksFromTableWithHandler(table, $) {
	var books = [];
	$(table).find('tr').each(function(i, row) {
		if (i == 0) {return;}
		var book = bookFromRow(row, $);
		if (book != undefined) { 
			books.push(book);
		}
	});
	return books;	
}