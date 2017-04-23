/**
 * todo consider how users are adding to the location index, and more importantly, how they are removed
 * (i.e. upon disconnect?).
 */
(function () {

    // GLOBALS for function
    var _loggedInUserFirebaseRef = null;
    var _loggedInUserLocationPin = null;

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

    var _loginBtn = $('#loginbtn');
    var _loginDiv = $('#login');
    _loginBtn.click(triggerLogin);

    var _activateDiv = $('#activate');
    $('#activateBtn').click(registerLocation);

    var _deActivateDiv = $('#deActivate');
    $('#deActivateBtn').click(deRegisterLocation);

    var _queryDiv = $('#query');

    $('#searchButton').click(query);
    $('#createUsers').click(addData);

    var logRef = $('#log');
    var _resultsDiv = $('#results');
    var _resultsList = $('#resultsList');

    var _userMap = {};

    // check for logged in user
    firebase.auth().getRedirectResult().then(function(result) {

        handleLogin(result);

    }).catch(function(error) {
        // Handle Errors here.
        var errorCode = error.code;
        var errorMessage = error.message;
        // The email of the user's account used.
        var email = error.email;
        // The firebase.auth.AuthCredential type that was used.
        var credential = error.credential;
        // ...
        log("*** Error logging in: " + errorMessage + " ***");
    });

    function triggerLogin() {

        var provider = new firebase.auth.FacebookAuthProvider();

        provider.addScope('public_profile');
        provider.addScope('user_friends');
        provider.addScope('email');

        firebase.auth().signInWithRedirect(provider);
    }

    function handleLogin(result) {
        if (result.credential) {
            // This gives you a Facebook Access Token. You can use it to access the Facebook API.
            var token = result.credential.accessToken;
            // ...
        }
        // The signed-in user info.
        var user = result.user;
        if (user) {
            log("*** Logged in as user: " + user.displayName + " ***");
            _loggedInUserFirebaseRef = saveUser(user.email, user.displayName, user.photoURL);
            _loginDiv.hide();
            _activateDiv.show();
        } else {
            log("*** Not logged in ***");
            _loginDiv.show();
        }
    }

    function registerLocation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(function(position) {
                log("User is located at lat: " + position.coords.latitude + " lng: " + position.coords.longitude);

                var locationPin = [position.coords.latitude, position.coords.longitude];
                _loggedInUserLocationPin = locationPin;

                if (_loggedInUserFirebaseRef) {
                    geoFire.set(_loggedInUserFirebaseRef.key, locationPin).then(function () {
                        log("user location for user: " + _loggedInUserFirebaseRef.key + " set");
                        _activateDiv.hide();
                        _deActivateDiv.show();
                        _queryDiv.show();
                    });
                }
            });
        } else {
            log("Geolocation is not supported by this browser.");
        }
    }

    function deRegisterLocation() {
        if (_loggedInUserFirebaseRef) {
            geoFire.remove(_loggedInUserFirebaseRef.key).then(function () {
                log("user location removed for user: " + _loggedInUserFirebaseRef.key);
                _deActivateDiv.hide();
                _activateDiv.show();
                _queryDiv.hide();
            });
        }
    }

    function query() {
        logRef.empty();
        // todo re-querying should cancel the previous query
        var locations = [];
        var start = Date.now();
        var radius = parseInt($('#distanceInput').val());
        log("*** Creating GeoQuery for radius " + radius + " ***");
        var geoQuery = geoFire.query({
            center: _loggedInUserLocationPin,
            radius: radius
        });

        var onKeyEnteredRegistration = geoQuery.on("key_entered", function (key, locationPin, distance) {
            log(key + " entered the query. Distance is " + distance + " km");
            var location = {"key": key, "location": locationPin, "distance": distance};
            locations.push(location);

            // load user for location
            loadUsersForLocations([location]).then(function(users) {
                var user = users[0];
                _userMap[user.id] = user;

                // Now have all the results and are ready to render
                // (note: there is an assumption that locations will come in quicker than users)
                if (locations.length === mapSize(_userMap)) {
                    renderResults(locations, _userMap);
                }
            });
        });

        var onKeyExitedRegistration = geoQuery.on("key_exited", function (key, locationPin, distance) {
            log(key + " exited the query. Distance is " + distance + " km");

            // remove this location from the locations array, the basis of the query
            locations.forEach(function(location, index) {
                if (location.key === key) {
                    locations.splice(index, 1);
                }
            });

            // and remove the corresponding user map
            delete _userMap[key];

            renderResults(locations, _userMap);
        });

        var onReadyRegistration = geoQuery.on("ready", function () {
            var duration = Date.now() - start;
            log("*** " + locations.length + " Location records retrieved in " + duration + "ms ***");
//            log("*** 'ready' event fired - cancelling query ***");
//            geoQuery.cancel();
        })
    }

    /**
     * @param locations
     * @returns {Promise} of users
     */
    function loadUsersForLocations(locations) {
        return new Promise(function(resolve, reject) {
            var startUserLoad = Date.now();
            var userPromises = locations.map(function(location) {
                return firebaseDatabase.ref("users/" + location.key).once('value');
            });

            RSVP.all(userPromises).then(function(userSnapshots) {
                // userSnapshots contains an array of results for the given promises
                var users = userSnapshots.map(function(userSnapshot) {
                    return userSnapshot.val();
                });

                var durationUserLoad = Date.now() - startUserLoad;
                log("*** " + users.length + " user records retrieved in " + durationUserLoad + "ms ***");

                users.forEach(function(user, index) {
                    var location = locations[index];
                    log("User: " + user.id + " distance: " + location.distance + " km: " + user.name
                        + " (" + user.locationName + ")");
                    // enrich the user with the location
                    user.location = location;
                });

                resolve(users);

            }).catch(function(reason){
                // if any of the promises fails.
                log("Error: " + reason);
                reject(reason);
            });
        });
    }

    function saveUser(email, name, photoURL) {
        var keyFromEmail = replaceAll(email, '.', '');
        var usersRef = firebaseDatabase.ref("users/" + keyFromEmail);
        var userToSet = {
            "id": keyFromEmail,
            "email": email,
            "name": name,
            "photoURL": photoURL
        };
        usersRef.set(userToSet);
        log("user created/updated: " + email + " with key: " + usersRef.key);
        return usersRef;
    }

    function addData() {

        var numUsers = 1000;
        var users = [];
        for (var i = 0; i < numUsers; i++) {
            users[i] = {
                "id": 7 + i,
                "name": "User " + i,
                "locationPin": [51.5201 - i * 0.001, 0.0933 - i * 0.001],
                "locationName": "Location of User " + i
            };
        }

//        var users = [
//            {
//                "id": 1,
//                "name": "Leanne",
//                "locationPin": [51.5201, 0.0933],
//                "locationName": "Barbican"
//            },
//            {
//                "id": 2,
//                "name": "Jim",
//                "locationPin": [51.5797, 0.1237],
//                "locationName": "Crouch End"
//            },
//            {
//                "id": 3,
//                "name": "Su",
//                "locationPin": [51.5783, 0.2527],
//                "locationName": "West Hendon"
//            },
//            {
//                "id": 4,
//                "name": "Richard",
//                "locationPin": [51.9492, 0.2834],
//                "locationName": "Hitchin"
//            },
//            {
//                "id": 5,
//                "name": "Lewis",
//                "locationPin": [51.9038, 0.1966],
//                "locationName": "Stevenage"
//            },
//            {
//                "id": 6,
//                "name": "Paul",
//                "locationPin": [51.5285, 0.0847],
//                "locationName": "Shoreditch"
//            }
//        ];

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

    /**
     * Assume: all users are loaded for each location
     *
     * 1. order locations
     * 2. create an array of users to match the order of the locations
     * 3. re-render the resultsList div
     * @param locations
     * @param userMap
     */
    function renderResults(locations, userMap) {

        // 1. order locations
        // the results appears to be received in the order in which they were entered into the db,
        // rather than ordered from near to far
        locations.sort(function(a, b) {
            if (a.distance === b.distance) {
                return 0;
            }

            if (a.distance < b.distance) {
                return -1;
            } else {
                return 1;
            }
        });

        // 2. create an array of users to match the order of the locations
        var users = locations.map(function(location) {
            return userMap[location.key];
        });

        // 3. re-render the resultsList div
        _resultsList.empty();

        users.forEach(function(user, index) {
            var imgMarkup = "";
            if (user.photoURL) {
                imgMarkup = '<img src="' + user.photoURL + '"/>';
            }
            _resultsList.append("<li>" + imgMarkup + "&nbsp;" + user.name + " (" + user.location.distance + "kms)</li>");
        });

        _resultsDiv.show();
    }

    // http://stackoverflow.com/questions/1144783/how-to-replace-all-occurrences-of-a-string-in-javascript
    function replaceAll(str, find, replace) {
        return str.replace(new RegExp(escapeRegExp(find), 'g'), replace);
    }

    function escapeRegExp(str) {
        return str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
    }

    function mapSize(objectAsMap) {
        var count = 0;
        for (var k in objectAsMap) {
            if (objectAsMap.hasOwnProperty(k)) {
                ++count;
            }
        }
        return count;
    }
})();
