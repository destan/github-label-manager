"use strict";

$(document).ready(function () {
  var username;
  var password;
  var targetUsername;
  var targetRepo;

  /**
  * username: github username <required>
  * password: github password (cleartext) <required>
  * addUncommited: boolean, if true indicates that the label is not (yet) a part of the target repo.
  *   This means that the label is either copied from another repo or added manually
  * callback: as the name suggests...
  */
  function listLabels(username, repo, addUncommited, callback){
    $.ajax({
      type: "GET",
      dataType: "jsonp",
      url: 'https://api.github.com/repos/' + username + '/' + repo + '/labels',
      success: function (response) {
        console.log("success: ");
        console.log(response);
        
        if(response && response.data){
          var labels = response.data;
          for (var i = labels.length - 1; i >= 0; i--) {
            var label = labels[i];
            console.log(label);

            label.color = label.color.toUpperCase();
            createNewLabelEntry(label, addUncommited);

            //sets target repo indicator text
            $('#targetRepoIndicator').text(username + "'s " + repo);

          }//for
        }//if

        if(typeof callback == 'function'){
          callback(response);
        }
      }
    });
  }

  function createLabel(label) {
    $.ajax({
      type: "POST",
      url: "https://api.github.com/repos/destan/scripts/labels",
      data: JSON.stringify(label),
      beforeSend: function (xhr) {
        xhr.setRequestHeader('Authorization', makeBasicAuth(username, password));
      },
      success: function (data) {
        console.log("success: " + data);
      }
    });
  }

  function makeBasicAuth(username, password) {
    return "Basic " + Base64.encode(username + ":" + password);
  }

  function createNewLabelEntry(label, addUncommited) {

    var action = ' action="none" ';
    var uncommitedSignClass = "";

    if(label === undefined || addUncommited){
      action = ' action="create" ';
      uncommitedSignClass = ' uncommited ';
    }

    if(label === undefined){
      label = {
        name: "",
        color: ""
      };
    }

    var origNameVal = ' orig-val="' + label.name + '"';
    var origColorVal = ' orig-val="' + label.color + '"';

    var newElementEntry = $('\
      <div class="label-entry ' + uncommitedSignClass + '" ' + action + '>\
        <input name="name" type="text" class="input-small" placeholder="Name" value="' + label.name + '" ' + origNameVal + '>\
        <span class="sharp-sign">#</span>\
        <input name="color" type="text" class="input-small color-box" placeholder="Color"  value="' + label.color + '" ' + origColorVal + '>\
        <button type="button" class="btn btn-danger delete-button">Delete</button>\
      </div>\
    ');

    newElementEntry.children().filter('.color-box').css('background-color', '#' + label.color);

    newElementEntry.children().filter(':input[orig-val]').change(function(e) {
      
      if($(this).val() == $(this).attr('orig-val')){
        $(this).parent().attr('action', 'none');
        $(this).parent().removeClass('uncommited');
      }
      else{
        $(this).parent().attr('action', 'update');
        $(this).parent().addClass('uncommited');
      }

      checkIfAnyActionNeeded();
    });

    newElementEntry.children().filter('.delete-button').click(function(e) {
      if(confirm('Really want to delete this?\n\nNote that this action only removes the label from this list not from Github.')){
        if($(this).parent().attr('action') == 'create'){
          $(this).parent().remove();
        }
        else{
          $(this).parent().prepend('<hr class="deleted">');
          $(this).siblings().attr('disabled', 'true');
          $(this).attr('disabled', 'true');
          $(this).parent().attr('action', 'delete');
        }
        checkIfAnyActionNeeded();
      }
    });

    //activate color picker on color-box field
    newElementEntry.children().filter('.color-box').ColorPicker({
      //http://www.eyecon.ro/colorpicker
      color: label.color,
      onSubmit: function(hsb, hex, rgb, el) {
        $(el).val(hex.toUpperCase());
        $(el).ColorPickerHide();
        $(el).css('background-color', '#' + hex);

        //-----------------------------
        //well here goes the copy-paste because normal binding to 'change' doesn't work
        // on newElementEntry.children().filter(':input[orig-val]').change(function...
        // since it is triggered programmatically  
        if($(el).val() == $(el).attr('orig-val')){
          $(el).parent().attr('action', 'none');
          $(el).parent().removeClass('uncommited');
        }
        else{
          $(el).parent().attr('action', 'update');
          $(el).parent().addClass('uncommited');
        }
        checkIfAnyActionNeeded();
        //-----------------------------
      },
      onBeforeShow: function () {
        $(this).ColorPickerSetColor(this.value);
      }
    })
    .bind('keyup', function(){
      $(this).ColorPickerSetColor(this.value);
      $(this).css('background-color', '#' + this.value);
    });

    $('#labelsForm').append(newElementEntry);
  }

  $('#addNewLabelEntryButton').click(function(e) {
    createNewLabelEntry();
  });

  function clearAllLabels(){
    $('#labelsForm').text('');
    $('#commitButton').attr('disabled', 'disabled');
  }

  $('#listLabelsButton').click(function(e) {
    $(this).button('loading');
    var theButton = $(this);// dealing with closure
    var username = $('#targetUrl').val().split(':')[0];
    var repo = $('#targetUrl').val().split(':')[1];

    targetUsername = username;
    targetRepo = repo;

    if(username && repo){
      clearAllLabels();

      listLabels(username, repo, false, function(response) {
        theButton.button('reset');
      });
    }
    else{
      alert("Please follow the format: \n\nusername:repo");
      theButton.button('reset');
    }
  });

  $('#resetButton').click(function(e) {
    $(this).button('loading');
    var theButton = $(this);// dealing with closure
    clearAllLabels();
    listLabels(targetUsername, targetRepo, false, function(response) {
      theButton.button('reset');
    });
  });

  $('#copyFromRepoButton').click(function(e) {
    $(this).button('loading');
    var theButton = $(this);// dealing with closure
    var username = $('#copyUrl').val().split(':')[0];
    var repo = $('#copyUrl').val().split(':')[1];

    if(username && repo){
      listLabels(username, repo, true, function(response) {
        theButton.button('reset');
      });//set addUncommited to true because those are coming from another repo 
    }
    else{
      alert("Please follow the format: \n\nusername:repo");
      theButton.button('reset');
    }
  });

  $('#commitButton').click(function(e) {
    $(this).button('loading');
    var theButton = $(this);// dealing with closure
    var password = $('#githubPassword').val();

    if(password.trim() == ''){
      alert('You need to enter your password for repo: ' + targetRepo + ' in order to commit labels.');
      theButton.button('reset');
    }

    //TODO commit
    console.log("COMMIT");

  });

  function serializeLabel(jObjectLabelEntry) {
    return {
      name: jObjectLabelEntry.filter('[name="name"]').val(),
      color: jObjectLabelEntry.filter('[name="color"]').val() 
    };
  }

  /**
  * returns true if any change has been made and activates or disactivates comit button accordingly
  */
  function checkIfAnyActionNeeded() {
    var isNeeded = $('.label-entry:not([action="none"])').length > 0;
    
    if(isNeeded){
      $('#commitButton').removeAttr('disabled');
    }
    else{
      $('#commitButton').attr('disabled', 'disabled'); 
    }

    return isNeeded;
  }

  /* ========== The rest is BASE64 STUFF ========== */
  var Base64 = {
    // http://stackoverflow.com/a/246813
    // private property
    _keyStr: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",

    // public method for encoding
    encode: function (input) {
      var output = "";
      var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
      var i = 0;

      input = Base64._utf8_encode(input);

      while (i < input.length) {

        chr1 = input.charCodeAt(i++);
        chr2 = input.charCodeAt(i++);
        chr3 = input.charCodeAt(i++);

        enc1 = chr1 >> 2;
        enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
        enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
        enc4 = chr3 & 63;

        if (isNaN(chr2)) {
          enc3 = enc4 = 64;
        } else if (isNaN(chr3)) {
          enc4 = 64;
        }

        output = output + this._keyStr.charAt(enc1) + this._keyStr.charAt(enc2) + this._keyStr.charAt(enc3) + this._keyStr.charAt(enc4);

      }

      return output;
    },

    // public method for decoding
    decode: function (input) {
      var output = "";
      var chr1, chr2, chr3;
      var enc1, enc2, enc3, enc4;
      var i = 0;

      input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");

      while (i < input.length) {

        enc1 = this._keyStr.indexOf(input.charAt(i++));
        enc2 = this._keyStr.indexOf(input.charAt(i++));
        enc3 = this._keyStr.indexOf(input.charAt(i++));
        enc4 = this._keyStr.indexOf(input.charAt(i++));

        chr1 = (enc1 << 2) | (enc2 >> 4);
        chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
        chr3 = ((enc3 & 3) << 6) | enc4;

        output = output + String.fromCharCode(chr1);

        if (enc3 != 64) {
          output = output + String.fromCharCode(chr2);
        }
        if (enc4 != 64) {
          output = output + String.fromCharCode(chr3);
        }

      }

      output = Base64._utf8_decode(output);

      return output;

    },

    // private method for UTF-8 encoding
    _utf8_encode: function (string) {
      string = string.replace(/\r\n/g, "\n");
      var utftext = "";

      for (var n = 0; n < string.length; n++) {

        var c = string.charCodeAt(n);

        if (c < 128) {
          utftext += String.fromCharCode(c);
        } else if ((c > 127) && (c < 2048)) {
          utftext += String.fromCharCode((c >> 6) | 192);
          utftext += String.fromCharCode((c & 63) | 128);
        } else {
          utftext += String.fromCharCode((c >> 12) | 224);
          utftext += String.fromCharCode(((c >> 6) & 63) | 128);
          utftext += String.fromCharCode((c & 63) | 128);
        }

      }

      return utftext;
    },

    // private method for UTF-8 decoding
    _utf8_decode: function (utftext) {
      var string = "";
      var i = 0;
      var c = c1 = c2 = 0;

      while (i < utftext.length) {

        c = utftext.charCodeAt(i);

        if (c < 128) {
          string += String.fromCharCode(c);
          i++;
        } else if ((c > 191) && (c < 224)) {
          c2 = utftext.charCodeAt(i + 1);
          string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
          i += 2;
        } else {
          c2 = utftext.charCodeAt(i + 1);
          c3 = utftext.charCodeAt(i + 2);
          string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
          i += 3;
        }

      }

      return string;
    }

  };//end of Base64

}); //end of doc ready