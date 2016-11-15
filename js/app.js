/*
  github-label-manager is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  github-label-manager is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with github-label-manager.  If not, see <http://www.gnu.org/licenses/>.
*/

"use strict";

$(document).ready(function () {
  var username;
  var password;
  var targetUsername;
  var targetRepo;
  var targetOwner;
  var isLoadingShown = false;
  var loadingSemaphore = (function() {
    var count = 0;

    return {
      acquire : function() {
        console.log("acq " + count);
        ++count;
        return null;
      },
      release : function() {
        console.log("rel " + count);
        if(count <= 0){
          throw "Semaphore inconsistency";
        }

        --count;
        return null;
      },
      isLocked : function() {
        return count > 0;
      }
    };
  }());

  $.ajaxSetup({
    cache: false,
    complete: function(jqXHR, textStatus) {
      loadingSemaphore.release();
      if(isLoadingShown && loadingSemaphore.isLocked() === false){
        writeLog("All operations are done.");

        //add close button
        $('#loadingModal').append('<div class="modal-footer"><button class="btn" data-dismiss="modal" aria-hidden="true">Close');
      }
    },
    beforeSend: function(xhr) {
      var password = $('#githubPassword').val();
      loadingSemaphore.acquire();
      xhr.setRequestHeader('Authorization', makeBasicAuth(targetUsername, password));
    }
  });

  /**
  * username: github username <required>
  * password: github password (cleartext) <required>
  * mode: 
  *       'list':
  *       'copy':
  * callback: as the name suggests...
  */
  function apiCallListLabels(username, repo, mode, callback){
    $.ajax({
      type: 'GET',
      url: 'https://api.github.com/repos/' + username + '/' + repo + '/labels',
      success: function (response) {
        console.log("success: ");
        console.log(response);
        
        if(response ){
          var labels = response;
          for (var i = labels.length - 1; i >= 0; i--) {
            var label = labels[i];
            console.log(label);

            label.color = label.color.toUpperCase();
            createNewLabelEntry(label, mode);

            //sets target indicator text
            $('#targetIndicator').html('Using <strong>' + targetOwner + "</strong>'s <strong>" + targetRepo + '</strong> as <strong>' + targetUsername + '</strong>');

          }//for
        }//if

        if(typeof callback == 'function'){
          callback(response);
        }
      }
    });
  }

  function apiCallCreateLabel(labelObject, callback) {

    $.ajax({
      type: "POST",
      url: 'https://api.github.com/repos/' + targetOwner + '/' + targetRepo + '/labels',
      data: JSON.stringify(labelObject),
      success: function (response) {
        console.log("success: ");
        console.log(response);
        if(typeof callback == 'function'){
          callback(response);
        }
        writeLog('Created label: ' + labelObject.name);
      },
      error: function(jqXHR, textStatus, errorThrown ) {
        writeLog('Creation of label failed for: ' + labelObject.name + ' Error: ' + errorThrown);
      }
    });
  }

  function apiCallUpdateLabel(labelObject, callback) {
    var originalName = labelObject.originalName;
    delete labelObject.originalName;

    $.ajax({
      type: "PATCH",
      url: 'https://api.github.com/repos/' + targetOwner + '/' + targetRepo + '/labels/' + originalName,
      data: JSON.stringify(labelObject),
      success: function (response) {
        console.log("success: ");
        console.log(response);
        if(typeof callback == 'function'){
          callback(response);
        }
        writeLog('Updated label: ' + originalName + ' => ' + labelObject.name);
      },
      error: function(jqXHR, textStatus, errorThrown ) {
        writeLog('Update of label failed for: ' + originalName + ' Error: ' + errorThrown);
      }
    });
  }

  function apiCallDeleteLabel(labelObject, callback) {
    $.ajax({
      type: "DELETE",
      url: 'https://api.github.com/repos/' + targetOwner + '/' + targetRepo + '/labels/' + labelObject.name,
      success: function (response) {
        console.log("success: ");
        console.log(response);
        if(typeof callback == 'function'){
          callback(response);
        }
        writeLog('Deleted label: ' + labelObject.name);
      },
      error: function(jqXHR, textStatus, errorThrown ) {
        writeLog('Deletion of label failed for: ' + labelObject.name + ' Error: ' + errorThrown);
      }
    });
  }

  function makeBasicAuth(username, password) {
    return "Basic " + Base64.encode(username + ":" + password);
  }

  function createNewLabelEntry(label, mode) {

    var action = ' action="none" ';
    var uncommitedSignClass = "";

    if(mode === 'copy' || mode === 'new'){
      action = ' action="create" new="true" ';
      uncommitedSignClass = ' uncommited ';
    }

    if(label === undefined || label === null){
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

      if($(this).val() == $(this).attr('orig-val')){//unchanged
        $(this).parent().attr('action', 'none');
        $(this).parent().removeClass('uncommited');
      }
      else{//changed
        if($(this).parent().attr('new') == 'true'){
          $(this).parent().attr('action', 'create');
        }
        else{
          $(this).parent().attr('action', 'update');
        }
        $(this).parent().addClass('uncommited');
      }

      checkIfAnyActionNeeded();
      return;
    });

    //Delete button
    newElementEntry.children().filter('.delete-button').click(function(e) {
      if(confirm('Really want to delete this?\n\nNote that this action only removes the label from this list not from Github.')){
        if($(this).parent().attr('new') == 'true'){
          $(this).parent().remove();
        }
        else{
          $(this).parent().prepend('<hr class="deleted">');
          $(this).siblings().attr('disabled', 'true');
          // $(this).attr('disabled', 'true');
          $(this).parent().attr('action', 'delete');
        }

        //add recover button
        var recoverButton = $('<a class="btn" href="#"><i class="icon-refresh"></i></a>');
        recoverButton.click(function() {
          debugger;
          //recover label-element's deleted state
          $(this).siblings().filter('hr').remove();
          $(this).siblings().removeAttr('disabled');
          if( $(this).siblings().filter('[name="name"]').attr('orig-val') == $(this).siblings().filter('[name="name"]').val() &&
              $(this).siblings().filter('[name="color"]').attr('orig-val') == $(this).siblings().filter('[name="color"]').val() ){

            $(this).parent().attr('action', 'none');
          }
          else{
            $(this).parent().attr('action', 'update');
          }
          $(this).remove();
          checkIfAnyActionNeeded();
        });//end recover button's click

        $(this).parent().append(recoverButton);

        checkIfAnyActionNeeded();
        return;
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
          if($(el).parent().attr('new') == 'true'){
            $(el).parent().attr('action', 'create');
          }
          else{
            $(el).parent().attr('action', 'update');
          }
          $(el).parent().addClass('uncommited');
        }
        checkIfAnyActionNeeded();
        return;
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
  createNewLabelEntry(null, 'new');
});

function clearAllLabels(){
  $('#labelsForm').text('');
  $('#commitButton').text('Commit changes');
  $('#commitButton').attr('disabled', 'disabled');
}

$('#listLabelsButton').click(function(e) {
  $(this).button('loading');
    var theButton = $(this);// dealing with closure
    targetOwner = $('#targetUrl').val().split(':')[0];
    targetRepo = $('#targetUrl').val().split(':')[1];
    targetUsername = $('#targetUsername').val();

    if(targetOwner && targetRepo){
      clearAllLabels();

      apiCallListLabels(targetOwner, targetRepo, 'list', function(response) {
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
    apiCallListLabels(targetOwner, targetRepo, 'list', function(response) {
      theButton.button('reset');
    });
  });

$('#copyFromRepoButton').click(function(e) {
  $(this).button('loading');
    var theButton = $(this);// dealing with closure
    var username = $('#copyUrl').val().split(':')[0];
    var repo = $('#copyUrl').val().split(':')[1];

    if(username && repo){
      apiCallListLabels(username, repo, 'copy', function(response) {
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
      return;
    }

    commit();
  });

  //Enable popovers 
  $('#targetUrl').popover({
    title: 'Example',
    content: '<code>github.com/destan/cevirgec</code> Then use <code>destan:cevirgec</code><br><em>Note that owner can also be an organization name.</em>',
    trigger: 'hover',
    html: true
  });

  $('#targetUsername').popover({
    title: "Why 'username' again?",
    content: "To let you modify a repo which belongs to another user or an organization. For example the repo maybe <code>my-organization:the-app</code> but username is <code>cylon</code>",
    trigger: "hover",
    html: true
  });

  $('#githubPassword').popover({
    title: "My password for what?",
    content: "Password is only required for committing. It won't be required until you try to commit something.",
    trigger: "hover",
    html: true
  });

  /**
  * Makes a label entry out of a div having the class .label-entry
  */
  function serializeLabel(jObjectLabelEntry) {
    return {
      name: jObjectLabelEntry.children().filter('[name="name"]').val(),
      color: jObjectLabelEntry.children().filter('[name="color"]').val(),
      originalName: jObjectLabelEntry.children().filter('[name="name"]').attr('orig-val')
    };
  }

  /**
  * returns true if any change has been made and activates or disactivates commit button accordingly
  */
  function checkIfAnyActionNeeded() {
    var isNeeded = $('.label-entry:not([action="none"])').length > 0;
    
    if(isNeeded){
      $('#commitButton').removeAttr('disabled');
      $('#commitButton').removeClass('disabled');
    }
    else{
      $('#commitButton').attr('disabled', 'disabled'); 
    }

    return isNeeded;
  }

  function commit() {
    //TODO same name check

    //freeze the world
    $('#loadingModal').modal({
      keyboard: false,
      backdrop:'static'
    });

    //To be deleted
    $('.label-entry[action="delete"]').each(function(index) {
      var labelObject = serializeLabel($(this));
      apiCallDeleteLabel(labelObject);
    });

    //To be updated
    $('.label-entry[action="update"]').each(function(index) {
      var labelObject = serializeLabel($(this));
      apiCallUpdateLabel(labelObject);
    });

    //To be created
    $('.label-entry[action="create"]').each(function(index) {
      var labelObject = serializeLabel($(this));
      apiCallCreateLabel(labelObject);
    });
  }

  function writeLog(string) {
    $('#loadingModal > .modal-body').append(string + '<br>');
  }

  $('#loadingModal').on('hide', function () {
    isLoadingShown = false;

    //reset modal
    $('#loadingModal > .modal-body').text('');
    $('#loadingModal > .modal-body').append('<p>Commiting...');
    $('#loadingModal > .modal-footer').remove();

    //reload labels after changes
    clearAllLabels();
    apiCallListLabels(targetOwner, targetRepo, 'list');
  });

  $('#loadingModal').on('show', function () {
    isLoadingShown = true;
  });

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
