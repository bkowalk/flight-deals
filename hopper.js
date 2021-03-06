var request = require('request');
var xpath = require('xpath');
var dom = require('xmldom').DOMParser;
var fs = require('fs');
var nodemailer = require('nodemailer');

console.log(new Date().toISOString());

//configure email service
var transporter = nodemailer.createTransport("SMTP",{
    service: 'gmail',
    auth: {
        user: 'my@email.com',
        pass:'########'
    }
});

//other config
var toString = "my@email.com";
var fromString = "my@email.com";
var searchUrl = "http://www.hopper.com/flights/feed?departure_day=&departure_flex=3%3A3&destination=region%2F26m5%2Cregion%2F25Cs%2Cregion%2F20oH%2Cregion%2F2CIv%2Cregion%2F1uw0%2Cregion%2F22wS%2Cregion%2F2FyS%2Cstate%2F1y08&origin=airport%2FSLC&return_day=&return_flex=3%3A3&deal_level=10&sort_by=recent&max_price=1200&stay=5-20&departure_month=";
var dataStoreDir = "/Users/bkowalk/Library/Hopper/store/";
var options = {
    url: searchUrl,
    headers:{
        'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/27.0.1453.110 Safari/537.36'
    }
};

//in case we ever want to save timing too:  + "\n" + Math.floor(Date.now()/1000/86400),

function storeNewBestFlight(airportCode,destinationName,price){
	var writeString = price + "\n" + destinationName;
    fs.writeFile(
        dataStoreDir + airportCode + ".txt", 
        writeString,
        function(err){
            if (err){return console.log(err);}
            console.log("File saved for " + airportCode + " (" + destinationName + ")");
        });
}

function fireNotification(airportCode,destinationName,price,oldPrice,isNew){
    var subjectString = "Alert: $" + price + " to " + destinationName + " (" + airportCode + ")";
    if (isNew){ subjectString = "New City: $" + price + " to " + destinationName; }
    transporter.sendMail({
       from: fromString,
       bcc: toString,
       subject: subjectString,
       html: "<p>Previous best: $" + oldPrice + "</p>"
            + "<p><a href='https://www.google.com/maps/search/" + destinationName.replace(/,/g,"").replace(/ /g,"+") + "'>Google Maps</a></p>"
            + "<p><a href='" + searchUrl +"'>Hopper</a></p>"
    }, function(error, response){
        if(error){
            console.log(error);
        } else {
            console.log("Message sent for " + airportCode);
            transporter.close();
        }
    });
}

function processFlightData(airportCode,destinationName,price){
    console.log("Saw " + airportCode + " - " + destinationName + " for " + price);
    
    //check if we've seen this before.
    fs.exists(dataStoreDir + airportCode + ".txt", function(exists){
        if (exists){
            //check price.  If this price is higher, do nothing.  If lower, store and send notification.
            var storedPriceFile = fs.readFileSync(dataStoreDir + airportCode + ".txt", 'utf8');
            var storedPrice = storedPriceFile.split("\n")[0];
            if (storedPrice == ""){
                console.log("Error - stored price for " + airportCode + " invalid");
            } else if (parseInt(price,10) < parseInt(storedPrice,10)){
                console.log ("New best for " + airportCode + "! Old best: " + storedPrice + ". New price: " + price);
                storeNewBestFlight(airportCode, destinationName, price);
                if (price < storedPrice * .90){ //only fire for big deal drops (10% off of more)!
                    fireNotification(airportCode, destinationName, price, storedPrice, false);
                }
            }
        } else{
            //write out file.  No notifications for a city only seen once.
            console.log(airportCode + " is new.");
            //storeNewBestFlight(airportCode,destinationName,price);
            /*if (price < 600){ //attempt to only show the good new ones
                fireNotification(airportCode, destinationName, price, storedPrice, true);
            }*/
        }
    });
}

function processFlightPage(error, response, body){
    if (!error){
        var doc = new dom({
            errorHandler:{
                warning:function(){},
                error:function(){},
                fatalError:function(){}
            }}).parseFromString(body);
        
        //we got the page.  Let's pull an object for each flight.
        var flights = xpath.select("//div[contains(@class, 'flights')]//div[contains(@class, 'flight')]", doc);
        flights.forEach(function(flight){
            var flightDoc = new dom({
                errorHandler:{
                    warning:function(){},
                    error:function(){},
                    fatalError:function(){}
                }}).parseFromString(flight.toString());
                
            //from each flight, let's grab airport code string.
            var airportCode = xpath.select("//@data-destination", flightDoc)
                .toString()
                .substring(19,22);
                
            //if airport string exits, then it wasn't a featured thingy.  Take the other values (with some massaging)
            if (airportCode){
                var destinationName = xpath.select("//div[contains(@class, 'destination-container')]//a[contains(@class, 'destination')]/text()", flightDoc)
                    .toString()
                    .replace(/(?:\r\n|\r|\n)/g, '');
                var price = xpath.select("//a[contains(@class, 'show-more')]//div[contains(@class, 'price')]/text()", flightDoc)
                    .toString()
                    .split("\n")[1]
                    .replace("$","")
                    .replace(",","");
                    
                //process this flight into our DB, send any alerts.
                processFlightData(airportCode,destinationName,price);
            }
        });
    } else {
        console.log(error);
    }
}

request(options,processFlightPage);
