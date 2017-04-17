(function () {
    // Initialize the Firebase SDK
    var config = {
        apiKey: "AIzaSyBiUQMPLNgTH81FNMWFuza32CONngyFhAY",
        authDomain: "lunch-54c74.firebaseapp.com",
        databaseURL: "https://lunch-54c74.firebaseio.com",
        projectId: "lunch-54c74",
        storageBucket: "lunch-54c74.appspot.com",
        messagingSenderId: "361721093034"
    };
    firebase.initializeApp(config);

    // Generate a random Firebase location
    var firebaseDatabase = firebase.database();
    var firebaseLocationsRef = firebase.database().ref("locations");

    // Create a new GeoFire instance at the random Firebase location
    var geoFire = new GeoFire(firebaseLocationsRef);

    $('#searchButton').click(query);
    $('#createUsers').click(addData);

    var logRef = $('#log');


    function query() {
        logRef.empty();
        var results = [];
        var start = Date.now();
        var radius = parseInt($('#distanceInput').val());
        log("*** Creating GeoQuery for radius " + radius + " ***");
        // todo pass in the center from the UI
        // todo on and off button that adds and removes to the locations
        var geoQuery = geoFire.query({
            center: [51.5285, 0.0847],
            radius: radius
        });

        var onKeyEnteredRegistration = geoQuery.on("key_entered", function (key, location, distance) {
            log(key + " entered the query. Distance is " + distance + " km");
            results.push({"key": key, "location": location, "distance": distance})
        });

        var onReadyRegistration = geoQuery.on("ready", function () {
            var duration = Date.now() - start;
            log("*** Location data retrieved in " + duration + "ms ***");
            log("*** 'ready' event fired - cancelling query ***");
            geoQuery.cancel();

            results.sort(function(a, b) {
                if (a.distance === b.distance) {
                    return 0;
                }

                if (a.distance < b.distance) {
                    return -1;
                } else {
                    return 1;
                }
            });

            var startUserLoad = Date.now();

            var userPromises = results.map(function(location) {
                return firebaseDatabase.ref("users/" + location.key).once('value');
            });

            RSVP.all(userPromises).then(function(userSnapshots) {
                // userSnapshots contains an array of results for the given promises
                var users = userSnapshots.map(function(userSnapshot) {
                    return userSnapshot.val();
                });

                users.forEach(function(user, index) {
                    var location = results[index];
                    log("User: " + user.id + " distance: " + location.distance + " km: " + user.name
                        + " (" + user.locationName + ")");
                });

                var durationUserLoad = Date.now() - startUserLoad;
                log("*** User data retrieved in " + durationUserLoad + "ms ***");

            }).catch(function(reason){
                // if any of the promises fails.
                log("Error: " + reason);
            });
        })
    }

    function addData() {
        var users = [
            {
                "id": 1,
                "name": "Leanne",
                "locationPin": [51.5201, 0.0933],
                "locationName": "Barbican"
            },
            {
                "id": 2,
                "name": "Jim",
                "locationPin": [51.5797, 0.1237],
                "locationName": "Crouch End"
            },
            {
                "id": 3,
                "name": "Su",
                "locationPin": [51.5783, 0.2527],
                "locationName": "West Hendon"
            },
            {
                "id": 4,
                "name": "Richard",
                "locationPin": [51.9492, 0.2834],
                "locationName": "Hitchin"
            },
            {
                "id": 5,
                "name": "Lewis",
                "locationPin": [51.9038, 0.1966],
                "locationName": "Stevenage"
            },
            {
                "id": 6,
                "name": "Paul",
                "locationPin": [51.5285, 0.0847],
                "locationName": "Shoreditch"
            }
        ];

        // Set the initial users and locations
        log("*** Setting initial users and locations ***");
        users.forEach(function (user) {
            return firebaseDatabase.ref("users/" + user.id).set(user).then(function () {
                log("user: " + user.id + " set");
            });
        });

        users.forEach(function (user) {
            return geoFire.set(user.id + "", user.locationPin).then(function () {
                log("user location for user: " + user.id + " set");
            });
        });

//        RSVP.allSettled(userPromises)
//            .then(function() {
//
//            });
    }


    /*************/
    /*  HELPERS  */
    /*************/
    /* Logs to the page instead of the console */
    function log(message) {
        var childDiv = document.createElement("div");
        var textNode = document.createTextNode(Date.now() + " : " + message);
        childDiv.appendChild(textNode);
        document.getElementById("log").appendChild(childDiv);
    }
})();
