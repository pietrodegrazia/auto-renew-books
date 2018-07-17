var moment = require('moment');
var request = require('request');
const cheerio = require('cheerio');
var fs = require('fs');

//fazer GET para: http://sabi.ufrgs.br/F?func=bor-loan&adm_library=URS50
//pegar endpoint do login
//fazer login (POST com dicionario do form)
//achar link do renew all
//fazer GET no link

//aqui tudo começa

// print process.argv
var args = process.argv;
var userId = args[2];
if (userId == undefined || userId.length != 8) {
	console.log("Identificação curta. Algo errado não está certo.");
	return -1;
}
var userPassword = args[3];
if (userPassword == undefined) {
	console.log("Senha não pode ser lida. Algo errado não está certo.");
	return -1;
}

getIndexPage();

function logWithDots(log) {
	console.log(log);	
}

function getIndexPage() {
	logWithDots('Buscando página incial...');
	request("http://sabi.ufrgs.br/F?func=bor-loan&adm_library=URS50", function (error, response, body) {
		if (error != undefined || response.statusCode != 200) {
			console.log('error:', error);
			console.log('statusCode:', response && response.statusCode);
			return;
		}
	  	didGetHTMLForIndex(body);
	});
}

function didGetHTMLForIndex(html) {
	logWithDots("Procurando URL pra LOGIN...");
	const indexPageHandler = cheerio.load(html);
	var form = indexPageHandler('#form1');
	var action = form.attr('action');
	if (form == undefined || action == undefined) {
		logWithDots("ERRO: Não encontrou URL pra LOGIN");
		return;
	}
	didGetURLForLogin(action);
}

function didGetURLForLogin(url) {
	logWithDots("Realizando LOGIN. Id: "+userId+" - Senha: "+userPassword);
	var bodyString = "ssl_flag=Y&func=login-session&login_source=bor-loan&bor_library=URS50&bor_id="+userId+"&bor_verification="+userPassword+"&x=51&y=9";
	var options = {
	    followAllRedirects: true,
	    url: url,
	    method: 'POST',
	    body: bodyString
	};
	request(options, function (error, response, body) {
	  	if (error != undefined || response.statusCode != 200) {
			console.log('error:', error);
			console.log('statusCode:', response && response.statusCode);
			return;
		}
		didGetLoggedInHTML(body);
	});
}

function didGetLoggedInHTML(html) {
	logWithDots("Procurando URL pra RENOVAR TODOS...");
	const loggedInPageHandler = cheerio.load(html);
	var renewAllURL = null;
	loggedInPageHandler('a').each(function(i, elem) {
		var href = loggedInPageHandler(this).attr('href');
		if(href.indexOf("func=bor-loan-renew-all") > -1) {
			renewAllURL = href;
		}
	});
	if (!renewAllURL) {
		logWithDots("ERRO: não encontrou URL para RENOVAR TODOS...");
		return;
	}
	didGetRenewAllURL(renewAllURL);
}

function didGetRenewAllURL(url) {
	logWithDots("Renovando Todos.");
	request(url, function (error, response, body) {
		if (error != undefined || response.statusCode != 200) {
			console.log('error:', error);
			console.log('statusCode:', response && response.statusCode);
			return;
		}
		didGetHTMLForRenewAll(body);
	});
}

function didGetHTMLForRenewAll(html) {	
	var targetText = ""
	const didRenewPageHandler = cheerio.load(html);
	
	var renewedBooks = getRenewedBooksWithHandler(didRenewPageHandler);
	var notRenewedBooks = getNotRenewedBooksWithHandler(didRenewPageHandler);

	logWithDots("RENOVADOS: "+renewedBooks.length);
	if (renewedBooks.length > 0) {logWithDots(renewedBooks);}
	
	logWithDots("NÃO RENOVADOS: "+notRenewedBooks.length);
	if (notRenewedBooks.length > 0) {logWithDots(notRenewedBooks);}

	var books = renewedBooks.concat(notRenewedBooks);
	console.log("Checando Status");
	for (var i=0; i < books.length; i += 1) {
		checkBookStatus(books[i]);
	}	
	return
}

function checkBookStatus(book) {
	console.log("\n\n"+book.title);
	var daysLeft = book.returnDate.diff(moment(), 'days');
	console.log("Dias restantes: "+daysLeft);
}

function getNotRenewedBooksWithHandler($) {
	logWithDots("Buscando por livros NÃO RENOVADOS.");
	var notRenewedTable = getTableForNotRenewedWithHandler($);
	if (notRenewedTable == undefined) { 
		logWithDots("NÃO encontrou livros. NÃO RENOVADOS = 0.");
		return [];
	}
	return booksFromTableWithHandler(notRenewedTable, $);
}

function getRenewedBooksWithHandler($) {
	logWithDots("Buscando por livros RENOVADOS.");

	var renewedTable = getTableForRenewedWithHandler($);
	if (renewedTable == undefined) { 
		logWithDots("NÃO encontrou livros. RENOVADOS = 0.");
		return [];
	}
	return booksFromTableWithHandler(renewedTable, $);
}

function getTableForRenewedWithHandler($) {
	var foundTable = undefined;
	$('table').each(function(i, table) {
		var tableHasNotRenewedTag = false;
		var isBooksTable = false;
		$(table).find('th').each(function(j, th) {
			tableHasNotRenewedTag = tableHasNotRenewedTag || ($(th).text() == "Motivo da não-renovação"); //faz o || pra evitar setar pra falso de volta
			isBooksTable = isBooksTable || ($(th).text() == "Data prev. devolução");
		});
		if (!tableHasNotRenewedTag && isBooksTable) {
			foundTable = table;
		}
	});
	return foundTable;
}

function getTableForNotRenewedWithHandler($) {
	var foundTable = undefined;
	$('table').each(function(i, table) {
		$(table).find('th').each(function(j, th) {
			if ($(th).text() == "Motivo da não-renovação") { 
				foundTable = table; 
			}
		});
	});
	return foundTable;
}

function bookFromRow(row, $) {
	var book = {};
	var cells = $(row).find('td');
	book.title = $(cells[1]).text();
	book.returnDate = moment($(cells[3]).text().replace(/ /g,''),'D/M/YYYY');
	book.library = $(cells[4]).text();
	book.statusCaption = $(cells[5]).text();
	if (book.title == "" || book.title == undefined) { return undefined; }
	if (book.returnDate == "" || book.returnDate == undefined) { return undefined; }
	return book;
}

function booksFromTableWithHandler(table, $) {
	var books = [];
	$(table).find('tr').each(function(i, row) {
		var book = bookFromRow(row, $);
		if (book != undefined) { 
			books.push(book);
		}
	});
	return books;	
}