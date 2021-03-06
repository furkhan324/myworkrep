var app = angular.module('flapperNews', ['ui.router']);


     
app.config(['$stateProvider', '$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {

	$stateProvider.state('home', {
		url : '/home',
		templateUrl : '/home.html',
		controller : 'MainCtrl',
		resolve : {
			postPromise : ['posts',
			function(posts) {
				return posts.getAll();
			}]

		}
	}).state('posts', {
		url : '/posts/:id',
		templateUrl : '/posts.html',
		controller : 'PostsCtrl',
		resolve : {
			post : ['$stateParams', 'posts',
			function($stateParams, posts) {
				return posts.get($stateParams.id);
			}]

		}
	}).state('login', {
		url : '/login',
		templateUrl : '/login.html',
		controller : 'AuthCtrl',
		onEnter : ['$state', 'auth',
		function($state, auth) {
			if (auth.isLoggedIn()) {
				$state.go('home');
			}
		}]

	}).state('register', {
		url : '/register',
		templateUrl : '/register.html',
		controller : 'AuthCtrl',
		onEnter : ['$state', 'auth',
		function($state, auth) {
			if (auth.isLoggedIn()) {
				$state.go('home');
			}
		}]

	});

	$urlRouterProvider.otherwise('home');
}]);

app.factory('auth', ['$http', '$window',
function($http, $window) {
	var auth = {};

	auth.saveToken = function(token) {
		$window.localStorage['flapper-news-token'] = token;
	};

	auth.getToken = function() {
		return $window.localStorage['flapper-news-token'];
	}

	auth.isLoggedIn = function() {
		var token = auth.getToken();

		if (token) {
			var payload = JSON.parse($window.atob(token.split('.')[1]));

			return payload.exp > Date.now() / 1000;
		} else {
			return false;
		}
	};

	auth.currentUser = function() {
		if (auth.isLoggedIn()) {
			var token = auth.getToken();
			var payload = JSON.parse($window.atob(token.split('.')[1]));
          //  console.log(payload);
			return payload.username;
		}
	};
    auth.payload = function() {
		if (auth.isLoggedIn()) {
			var token = auth.getToken();
			var payload = JSON.parse($window.atob(token.split('.')[1]));
        
			return payload;
		}
	};

	auth.register = function(user) {
        console.log('we got hee bro');
		return $http.post('/register', user).success(function(data) {
			auth.saveToken(data.token);
		});
	};

	auth.logIn = function(user) {
		return $http.post('/login', user).success(function(data) {
			auth.saveToken(data.token);
		});
	};

	auth.logOut = function() {
		$window.localStorage.removeItem('flapper-news-token');
	};

	return auth;
}]);

app.factory('posts', ['$http', 'auth',
function($http, auth) {
	var o = {
		posts : []
	};

	o.getAll = function() {
		return $http.get('/posts').success(function(data) {
			angular.copy(data, o.posts);
		});
	};
	//now we'll need to create new posts
	//uses the router.post in index.js to post a new Post mongoose model to mongodb
	//when $http gets a success back, it adds this post to the posts object in
	//this local factory, so the mongodb and angular data is the same
	//sweet!
	o.create = function(post,user) {
	  return $http.post('/posts', post, {
	    headers: {Authorization: 'Bearer '+auth.getToken()}
	  }).success(function(data){
          user.somefield=data;
          console.log(user);
          console.log("Ok heres my user post" +data);
          $http.post('/addID/'+data._id, user).success(function(data2) {
			auth.saveToken(data2.token);
		});
	    o.posts.push(data);
	  });
	};
	
	o.upvote = function(post) {
        console.log(auth.currentUser()+' this is the current user');
	  return $http.put('/posts/' + post._id + '/upvote', null, {
	    headers: {Authorization: 'Bearer '+auth.getToken()}
	  }).success(function(data){
	    post.upvotes += 1;
	  });
	};
    o.upvotePersistent = function(post) {
	  return $http.put('/posts/' + post._id +'/'+auth.currentUser()+ '/upvote', null, {
	    headers: {Authorization: 'Bearer '+auth.getToken()}
	  }).success(function(data){
          //data needs to be refreshed on both client and 
	    post.upvotes += 1;
        post.upvotedBy.push(auth.currentUser());
	  });
	};
    
	//downvotes
	o.downvote = function(post) {
	  return $http.put('/posts/' + post._id + '/downvote', null, {
	    headers: {Authorization: 'Bearer '+auth.getToken()}
	  }).success(function(data){
	    post.upvotes -= 1;
	  });
	};
	//grab a single post from the server
	o.get = function(id) {
		//use the express route to grab this post and return the response
		//from that route, which is a json of the post data
		//.then is a promise, a kind of newly native thing in JS that upon cursory research
		//looks friggin sweet; TODO Learn to use them like a boss.  First, this.
		return $http.get('/posts/' + id).then(function(res) {
			return res.data;
		});
	};
	//comments, once again using express
	o.addComment = function(id, comment) {
	  return $http.post('/posts/' + id + '/comments', comment, {
	    headers: {Authorization: 'Bearer '+auth.getToken()}
	  });
	};
	
	o.upvoteComment = function(post, comment) {
	  return $http.put('/posts/' + post._id + '/comments/'+ comment._id + '/upvote', null, {
	    headers: {Authorization: 'Bearer '+auth.getToken()}
	  }).success(function(data){
	    comment.upvotes += 1;
	  });
	};	
    o.upvoteCommentPersistent = function(post, comment) {
	  return $http.put('/posts/' + post._id +'/'+auth.currentUser()+ '/comments/'+ comment._id + '/upvote', null, {
	    headers: {Authorization: 'Bearer '+auth.getToken()}
	  }).success(function(data){
	    comment.upvotes += 1;
          comment.upvotedBy.push(auth.currentUser());
	  });
	};
	//downvote comments
	//I should really consolidate these into one voteHandler function
	o.downvoteComment = function(post, comment) {
	  return $http.put('/posts/' + post._id + '/comments/'+ comment._id + '/downvote', null, {
	    headers: {Authorization: 'Bearer '+auth.getToken()}
	  }).success(function(data){
	    comment.upvotes -= 1;
	  });
	};	
	return o;
}]);



app.controller('MainCtrl', ['$scope', 'posts', 'auth',
function($scope, posts, auth) {
    $scope.isLoggedIn = auth.isLoggedIn;
	$scope.currentUser = auth.currentUser();
	$scope.logOut = auth.logOut;
	$scope.posts = posts.posts;
	$scope.isLoggedIn = auth.isLoggedIn;
	$scope.searchType = '';
	$scope.select = {
		value1: "Option1",
        value2: "I'm an option",
        choices: ["Option1", "I'm an option", "This is materialize", "No, this is Patrick."]
	}
	//setting title to blank here to prevent empty posts
    
	$scope.title = '';
    
    String.prototype.hashCode = function(){
    if (Array.prototype.reduce){
        return this.split("").reduce(function(a,b){a=((a<<5)-a)+b.charCodeAt(0);return a&a},0);              
    } 
    var hash = 0;
    if (this.length === 0) return hash;
    for (var i = 0; i < this.length; i++) {
        var character  = this.charCodeAt(i);
        hash  = ((hash<<5)-hash)+character;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
}

    $scope.color = function(post){
                 console.log("we called findcolor");

        var hash = new String(post.name).hashCode();
        var lastc = hash.toString().slice(-1);
        var arrayofcolors = ["#0091ea","#00b0ff", "40c4ff", "#80d8ff", "#01579b", "#0277bd","#0288d1", "#039be5", "#03a9f4", "#29b6f6 "];
        console.log("we called findcolor");
        return "background-color:"+arrayofcolors[lastc]+";border:none;outline:none;";
        
        
    }
    
	$scope.addPost = function() {
		if ($scope.title === '') {
			return;
		}
		posts.create({
			title : $scope.title,
			link : $scope.link,
		});
		//clear the values
		$scope.title = '';
		$scope.link = '';
	};

	$scope.upvote = function(post) {

		//our post factory has an upvote() function in it
		//we're just calling this using the post we have
		console.log('Upvoting:' + post.title + "votes before:" + post.upvotes);
		posts.upvote(post);
	};
	$scope.downvote = function(post) {
		posts.downvote(post);
	};
}]);

app.controller('PostsCtrl', ['$scope', 'posts', 'post', 'auth',
function($scope, posts, post, auth) {
  $scope.model={};
    $scope.model.body="";
	$scope.post = post;
    console.log(post);
	$scope.isLoggedIn = auth.isLoggedIn;
    $scope.showError=false;
    $scope.showSuccess=false;
	$scope.addComment = function() {
                console.log(document.getElementById('sensorText').value);

        $scope.showError=false;
    $scope.showSuccess=false;
		if (!document.getElementById('sensorText').value) {
            console.log(document.getElementById('sensorText').value);
            $scope.showError= true;
        
		}else{
            
        console.log("OOPS NOT SUPPOSED TO BE HERE");
		posts.addComment(post._id, {
			body : document.getElementById('sensorText').value,
			author : auth.payload().name,
            date: Date.now(),
            datef: (new Date()).toString(),
            postid:auth.payload().postid,
            upvotedBy:[]
		}).success(function(comment) {
			$scope.post.comments.push(comment);
            $scope.showSuccess =true;
            
            
		});
		document.getElementById('sensorText').value = ''; }
	};
    
	$scope.upvote = function(comment) {
		posts.upvoteComment(post, comment);
	};
    $scope.upvoteCommentPersistent = function(comment) {
        console.log('upvote comment persistent was just called');
        posts.upvoteCommentPersistent(post, comment);
	};
    
    $scope.upvotePost = function(post) {
		//our post factory has an upvote() function in it
		//we're just calling this using the post we have
		console.log('Upvoting:' + post.title + "votes before:" + post.upvotes);
		posts.upvote(post);
       
	};
    $scope.upvotePostPersistent = function(post) {
        console.log('upvote post persistent was just called');
		console.log('Upvoting:' + post.title + "votes before:" + post.upvotes);
		posts.upvotePersistent(post);
     
	};
	$scope.downvote = function(comment) {
		posts.downvoteComment(post, comment);
	};
    $scope.showCommentActive = function(comment){
    if (comment.upvotedBy.indexOf(auth.currentUser())!=-1){ //or 'user'
 	  // console.log('the array contains the item, so you liked the comment  already');
	   return 'false';
	 }
    else{
 //	  console.log('nope not in the comment so you havent liked the comment before');
        return 'true';
    }
    };
     $scope.setupmap=function(post){
        console.log("set up map was called");
          console.log(document.getElementById('map'));
         initMap(post);
         return true;
    }

    $scope.showPostActive = function(post){
      //  console.log("the post's upvoted by array" + post.upvotedBy);
  //      console.log(post.upvotedBy);
    if (post.upvotedBy.indexOf(auth.currentUser())!=-1){ //or 'user'
 	 //  console.log('the array contains the item, so you liked the post already');
	   return 'false';
	 }
    else{
 	//  console.log('nope not in the array so you havent liked the post before');
        return 'true';
    }
    }

}]);
function initMap(post) {
          console.log("was this even called");
          console.log(document.getElementById('map'));
        var map = new google.maps.Map(document.getElementById('map'), {
          zoom: 12,
          center: {lat: -34.397, lng: 150.644}
        });
                  console.log(map);

        var geocoder = new google.maps.Geocoder();
geocodeAddress(geocoder,map,post);
      }

      function geocodeAddress(geocoder, resultsMap,post) {
        var address = post.location;
          console.log(post.location);
        geocoder.geocode({'address': address}, function(results, status) {
          if (status === google.maps.GeocoderStatus.OK) {
            resultsMap.setCenter(results[0].geometry.location);
            var marker = new google.maps.Marker({
              map: resultsMap,
              position: results[0].geometry.location
            });
          } else {
            console.log('Geocode was not successful for the following reason: ' + status);
          }
        });
      }
app.controller('AuthCtrl', ['$scope', '$state', 'auth', 'posts', 
function($scope, $state, auth, posts) {
	$scope.user = {};
    console.log(posts.posts);
    $scope.showError2 =false;
    $scope.errorMessage ="";
    $scope.showError3 =false;
    $scope.errorMessage2 ="";
    
   
	$scope.register = function() {
        //console.log("name: "+ $scope.user.name);
        if(!$scope.user.name ||!$scope.user.position||!$scope.user.location||!$scope.user.desc||!$scope.user.since){
                $scope.errorMessage ="Fields cannot be left blank";
            $scope.showError2=true;
            return;

            }
		auth.register($scope.user).error(function(error) {
			$scope.error = error;
            console.log(error);
            $scope.showError2=true;
            if(error.message==='bad password'){
                $scope.errorMessage ="Invalid password choice";
            }if(error.message==='bad username'){
                $scope.errorMessage ="Invalid username choice";
            }if(error.message==='username taken'){
                $scope.errorMessage ="Username is taken";
            }
            
		}).then(function() {
            posts.create({
                name: $scope.user.name,
			    position : $scope.user.position,
                location:$scope.user.location,
                desc: $scope.user.desc,
                since: $scope.user.since,
                upvotedBy:[]

        },$scope.user);
			$state.go('home');
		});
	};

	$scope.logIn = function() {
        
		auth.logIn($scope.user).error(function(error) {
			$scope.error = error;
            $scope.showError3=true;
            $scope.errorMessage2 =error.message;


		}).then(function() {
			$state.go('home');
		});
	};
}]);

app.controller('NavCtrl', ['$scope', 'auth',
function($scope, auth) {
	$scope.isLoggedIn = auth.isLoggedIn;
	$scope.currentUser = auth.currentUser;
	$scope.logOut = auth.logOut;
}]);

