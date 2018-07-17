var moment = require('moment');
var request = require('request');
request = request.defaults({jar: true});
const cheerio = require('cheerio');

var URL = {
	index: "http://biblioteca.uniritter.edu.br/mobile/login.php?flag=renovacao.php",
	login: "http://biblioteca.uniritter.edu.br/mobile/login.php",
	session: function (location) {
		var url = "http://biblioteca.uniritter.edu.br/";
		location = location.replace('../','');
		url += location;
		return url;
	},
	renew: function (parameter) {
		// ?cod_acervo=555021&cod_exemplar=353551
		return "http://biblioteca.uniritter.edu.br/mobile/confirmar_renovacao.php" + parameter;
	}
}

function getIndex() {
	console.log('Buscando index...');
	request(URL.index, function (error, response, body) {
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
	var options = {
		url: URL.login,
		form: {
			flag: "renovacao.php",
			login: userId,
			password: userPassword,
			button: "Access" 
		},
		followAllRedirects: true
	};
	request.post(options, function(error, response, body) {
		if (error != undefined || response.statusCode != 200) {//NESSE VAI 302 pq QUERO um redirect
			console.log('error:', error);
			console.log('statusCode:', response && response.statusCode);
			return;
		}
	    didGetBooksPage(body);
	});
}

function didGetBooksPage(html) {
	//busca esse link (a)->						renovacao_info.php        ?cod_acervo=555021&cod_exemplar=353551
	console.log("Buscando livros.");
	console.log(html);
	const $ = cheerio.load(html);
	var parameters = [];
	$('a').each(function(i, a) {
		var href = $(a).attr('href');
		if (href.indexOf("renovacao_info.php") >= 0) {
			var parameter = href.substr(href.indexOf("?"));
			parameters.push(parameter);	
		}
	});
	renewBooks(parameters);
}

function renewBooks(parameters) {
	// e faz get nesse
	// http://biblioteca.uniritter.edu.br/mobile/confirmar_renovacao.php  ?cod_acervo=555021&cod_exemplar=353551
	for (var i = 0; i < parameters.length; i += 1) {
		renewBook(parameters[i]);
	}
}

function renewBook(parameter) {
	console.log("Tentando renovar livro com parametro: "+parameter);

	request(URL.renew(parameter), function (error, response, body) {
		if (error != undefined) {//NESSE VAI 302 pq QUERO um redirect
			console.log('error:', error);
			console.log('statusCode:', response && response.statusCode);
			return;
		}
		console.log(body);
		return;
	});
}

// function didGetSessionURL(url) {
// 	fetchRenewPage();
// 	return;
// 	console.log("Fazendo chamada da sessão.");
// 	var options = {
// 		url: url
// 	}
// 	request(options, function (error, response, body) {
// 		if (error != undefined) {//NESSE VAI 302 pq QUERO um redirect
// 			console.log('error:', error);
// 			console.log('statusCode:', response && response.statusCode);
// 			return;
// 		}
// 		var str = JSON.stringify(response, null, 4);
// 		console.log(str);
// 		console.log("\n\n\n\n\n\n");
// 		// var location = response.headers['location'];
// 		console.log(body);
// 		return;
// 	});
// }

// function fetchRenewPage() {
// 	console.log("Buscando Livros pra renovar.");
// 	request(URL.renew, function (error, response, body) {
// 		if (error != undefined || response.statusCode != 200) {
// 			console.log('error:', error);
// 			console.log('statusCode:', response && response.statusCode);
// 			return;
// 		}
// 		console.log(body);
// 		return;
// 	});
// }

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

getIndex();