'use strict';

angular.module('genesys.css-inputs', []);

angular.module('genesys.css-inputs').factory(

    'Utilities',

    function(){

         function Utilities(){


            this.uniqueName = function(sPrefix){

                var sPrefix = sPrefix||"",
                    id = Math.random().toString().replace("0.", ""),
                    sName = sPrefix+"_"+id,
                    ndMatchedInput = $("input[name="+ sName +"], select[name="+ sName +"], textarea[name="+ sName +"]");

                if(ndMatchedInput.length > 0){

                    return this.uniqueName(sPrefix);

                }else{

                    return sName;
                }
            };

            this.CSVToProperties = function(sCSV, value){

                var aProps = sCSV.split(","),
                    oOut = {},
                    value = value||null;

                $(aProps).each(function(){

                    oOut[this.replace(/^\s/, "")] = value;
                });

                return oOut;
            };
        }

        return new Utilities();
    }
);

angular.module('genesys.css-inputs').factory(

    'StylesheetModifier',

    function(){

        function StylesheetModifier(){

            var sStylesheetTitle = "",
                oStylesheet = {},
                aRules = [],
                aHistory = [],
                iReplayInterval = false;


            this.setStylesheet = function(sStyleSheet){

                if(sStylesheetTitle != sStyleSheet){

                    sStylesheetTitle = sStyleSheet;
                    oStylesheet = findStylesheetByTitle(sStyleSheet);
                    aRules = getRules(oStylesheet)||[];
                }

                return this;
            };

            this.changeStyleBySelector = function(sStyleSheet, sSelectorText, oProperties, bUndoing, bNewRule){

                this.setStylesheet(sStyleSheet);

                var oRule = false,
                    oHistoryEntry = {selector: sSelectorText, properties: {}, previous: {}, bNewRule: false},
                    iRuleIndex = 0;

                for(var i=0; i<aRules.length; i++){

                    if(aRules[i].selectorText == sSelectorText){

                        oRule = aRules[i];

                        iRuleIndex = i;

                        i = 999999;
                    }
                }

                // If rule not found, create it
                for(var property in oProperties){

                    oHistoryEntry.previous[property] = (oRule)?oRule.style[property]:"";

                    if(oRule){

                        oRule.style[property] = oProperties[property];
                    
                    }else{

                        if(oStylesheet.insertRule){

                            oStylesheet.insertRule(sSelectorText+" { "+ property +": "+ oProperties[property] +" } ", aRules.length);
                        
                        }else if(oStylesheet.addRule){

                            oStylesheet.addRule(sSelectorText, property +": "+ oProperties[property], aRules.length);
                        }

                        aRules = getRules(oStylesheet)||[];
                        oHistoryEntry.bNewRule = true;
                    }

                    oHistoryEntry.properties[property] = oProperties[property];

                    //console.log(sSelectorText+" { "+ property +": "+ oProperties[property] +" } ");
                    //console.log(oProperties[property])
                    //console.log(oHistoryEntry)

                    if(!bUndoing){

                        addToHistory(oHistoryEntry);
                    
                    }else{

                        if(bNewRule){

                            oStylesheet.removeRule(iRuleIndex);
                        }
                    }
                }

                return this;
            };

            this.raw = function(){

                var sRaw = "";

                for(var i=0; i<aRules.length; i++){

                    sRaw += aRules[i].cssText;
                }

                return minifyCSS(sRaw);
            };

            function addToHistory(oHistoryItem){

                aHistory.push(oHistoryItem);
            }

            this.getHistory = function(){

                return aHistory;
            };

            this.distillHistory = function(aRules){

                var aRules = aRules||aHistory,
                    oOut = {},
                    aOut = [];

                for(var i=0; i<aRules.length; i++){

                    if(!oOut[aRules[i].selector]){

                        oOut[aRules[i].selector] = {properties: {}};
                    }

                    for(var property in aRules[i].properties){

                        oOut[aRules[i].selector].properties[property] = aRules[i].properties[property];

                        if(aRules[i].bNewRule){

                            oOut[aRules[i].selector].bNewRule = true;
                        }
                    }
                }

                for(var item in oOut){

                    aOut.push({selector: item, properties: oOut[item].properties, bNewRule: (oOut[item].bNewRule||undefined)})
                }

                return aOut;
            };

            this.getRules = function(){

                var aOut = [];

                for(var i=0; i<aRules.length; i++){

                    var aSplitRule = minifyCSS(aRules[i].cssText).replace(/\}/ig, "").split("{"),
                        aPropertyGroups = aSplitRule[1].split(";"),
                        aProperties = [];

                    $(aPropertyGroups).each(function(){

                        var aSplit = this.split(":"),
                            oProperty = {};

                        oProperty[aSplit[0]] = aSplit[1];

                        aProperties.push(oProperty);
                    });

                    aOut.push({selector: aSplitRule[0], properties: aProperties[0]});
                }

                return aOut;
            };

            this.revert = function(){

                var aHistoryReversed = aHistory.reverse();

                for(var i=0; i<aHistoryReversed.length; i++){

                    this.changeStyleBySelector("chat-ui", aHistoryReversed[i].selector, aHistoryReversed[i].previous, true, aHistoryReversed.bNewRule);
                }

                aHistory = [];

                return this;
            };

            this.replay = function(aReplay){

                var aReplay = aReplay||[],
                    oThis = this,
                    i = 0;

                this.revert();

                if(!iReplayInterval && aReplay.length > 0){

                    iReplayInterval = setInterval(function(){

                        oThis.changeStyleBySelector("chat-ui", aReplay[i].selector, aReplay[i].properties);
                        
                        i++;

                        if(i >= aReplay.length){

                            clearInterval(iReplayInterval);
                            iReplayInterval = false;
                        }

                    }, 50);
                }

                return this;
            }

            this.applyPreset = function(aPreset){

                this.revert();

                for(var i=0; i<aPreset.length; i++){

                    this.changeStyleBySelector("chat-ui", aPreset[i].selector, aPreset[i].properties);
                }

                return this;
            };

            this.generatePreset = function(){

                return JSON.stringify(window.SM.distillHistory());
            };

            function findStylesheetByTitle(sStylesheetTitle){

                for(var i=0; i<document.styleSheets.length; i++){

                    if(document.styleSheets[i].title == sStylesheetTitle){

                        return document.styleSheets[i];
                    }
                }

                return false;
            }

            function getRules(oStylesheet){

                if(oStylesheet.cssRules){
                
                    return oStylesheet.cssRules;
                
                }else if(oStylesheet.rules){

                    return oStylesheet.rules;
                }

                return false;
            }

            function minifyCSS(sCSS){

                return sCSS
                    .replace(/ \}/g, "}")
                    .replace(/\} /g, "}")
                    .replace(/ {/g, "{")
                    .replace(/\{ /g, "{")
                    .replace(/\; /g, ";")
                    .replace(/\: /g, ":")
                    .replace(/ \:/g, ":")
                    .replace(/\, /g, ",")
                    .replace(/\;\}/g, "}")

                return sCSS;
            }
        }





        function parseAndConvertRGBtoHex(sRGB){

            if(sRGB.substr(0,3) == "rgb"){

                sRGB = sRGB.replace(/rgb|rgba|\(|\)| /ig, "");

                var aRGB = sRGB.split(",");
                
                return "#"+  convertIntegerToHex(aRGB[0])  +  convertIntegerToHex(aRGB[1])  +  convertIntegerToHex(aRGB[2]);

            }else{


                return sRGB;
            }
        }

        function convertIntegerToHex(iNumber){

            var sHex = (parseInt(iNumber)||0).toString(16);

            if(sHex.length == 1){

                sHex = "0"+sHex;
            }

            return sHex;
        }

        return window.SM = new StylesheetModifier();
    }
);


angular.module('genesys.css-inputs').directive(

    'genesysColorPicker',

    function(StylesheetModifier, Utilities){

        return {

            templateUrl: "src/js/genesys.css-inputs/templates/color-picker.html",
            restrict: 'E',
            replace: true,
            scope: true,
            link: function($scope, ndColorPicker, attrs){

                $scope.label = attrs.label;
                $scope.selector = attrs.selector;
                $scope.property = attrs.property;

                var ndInput = $(ndColorPicker).find("> input");

                ndInput.ColorPicker({

                    onChange: function(hsb, hex, rgb){

                        ndInput.css({"background-color": "#"+hex, "background": "#"+hex}).val("#"+hex.toUpperCase()).change();
                    },
                    onSubmit: function(hsb, hex, rgb, el){

                        ndInput.css({"background-color": "#"+hex, "background": "#"+hex}).val("#"+hex.toUpperCase()).change();
                    }

                }).bind('keyup', function(){
                    
                    $(this).ColorPickerSetColor(this.value);
                
                }).bind('change', function(){

                    $(this).ColorPickerSetColor(this.value);

                    var oProperties = Utilities.CSVToProperties(ndInput.attr("property"), ndInput.val());

                    StylesheetModifier.changeStyleBySelector($scope.stylesheet, ndInput.attr("selector"), oProperties);
                });

                // Set Initial value
                //ndInput.ColorPickerSetColor(ndInput.val());

                var ndButton = $(ndColorPicker).find("> button");

                ndButton.click(function(){

                    var oProperties = Utilities.CSVToProperties(ndInput.attr("property"), ndButton.attr("value"));
                    
                    StylesheetModifier.changeStyleBySelector($scope.stylesheet, $scope.selector, oProperties);

                    ndInput.css({"background-color": "", "background": ""}).val("");
                });
            }   
        };
    }
);











angular.module('genesys.css-inputs').directive(

    'genesysFontPicker',

    function(StylesheetModifier, Utilities){

        return {

            templateUrl: "src/js/genesys.css-inputs/templates/font-picker.html",
            restrict: 'E',
            replace: true,
            scope: true,
            link: function($scope, ndFontPicker, attrs){

                $scope.label = attrs.label;
                $scope.selector = attrs.selector;
                
                var ndInput = $(ndFontPicker).find("> select");

                ndInput.change(function(){

                    StylesheetModifier.changeStyleBySelector($scope.stylesheet, $scope.selector, {"font-family": ndInput.val()});
                });
            }
        };
    }
);





angular.module('genesys.css-inputs').directive(

    'genesysSlider',

    function(StylesheetModifier, Utilities){

        return {

            templateUrl: "src/js/genesys.css-inputs/templates/slider.html",
            restrict: 'E',
            replace: true,
            scope: true,
            link: function($scope, ndSlider, attrs){

                $scope.label = attrs.label;
                $scope.selector = attrs.selector;
                $scope.property = attrs.property;
                $scope.min = parseInt(attrs.min);
                $scope.max = parseInt(attrs.max);
                $scope.step = parseInt(attrs.step);
                $scope.value = parseInt(attrs.value);
                
                var ndInput = $(ndSlider).find("> .css-input.slider"),
                    ndValue = $(ndSlider).find("> span");


                ndInput.slider({

                    value: $scope.value,
                    min: $scope.min,
                    max: $scope.max,
                    step: $scope.step,
                    slide: function(event, ui){
                        
                        ndValue.html(ui.value +"px");

                        var oProperties = Utilities.CSVToProperties(ndInput.attr("property"), ui.value+"px");

                        StylesheetModifier.changeStyleBySelector($scope.stylesheet, $scope.selector, oProperties);
                    }
                });
            }
        };
    }
);



angular.module('genesys.css-inputs').directive(

    'genesysAlignmentPicker',

    function(StylesheetModifier, Utilities){

        return {

            templateUrl: "src/js/genesys.css-inputs/templates/alignment-picker.html",
            restrict: 'E',
            replace: true,
            scope: true,
            link: function($scope, ndAlignmentPicker, attrs){

                $scope.label = attrs.label;
                $scope.selector = attrs.selector;
                $scope.unique_name = Utilities.uniqueName("alignment");
                
                $(ndAlignmentPicker).find("input").change(function(){

                    var ndInput = $(ndAlignmentPicker).find("input:checked");

                    if($scope.float){

                        StylesheetModifier.changeStyleBySelector($scope.stylesheet, $scope.selector, {"float": ndInput.val()});

                    }else{

                        StylesheetModifier.changeStyleBySelector($scope.stylesheet, $scope.selector, {"text-align": ndInput.val()});
                    }
                });
            }
        };
    }
);

angular.module('genesys.css-inputs').directive(

    'genesysCheckbox',

    function(StylesheetModifier, Utilities){

        return {

            templateUrl: "src/js/genesys.css-inputs/templates/checkbox.html",
            restrict: 'E',
            replace: true,
            scope: true,
            link: function($scope, ndCheckbox, attrs){

                $scope.label = attrs.label;
                $scope.selector = attrs.selector;
                $scope.property = attrs.property;
                $scope.checked = attrs.checked;
                $scope.unchecked = attrs.unchecked;
                $scope.unique_name = Utilities.uniqueName("checkbox");
                
                $(ndCheckbox).find("input[type=checkbox]").change(function(){

                    var bChecked = !!$(ndCheckbox).find("input[type=checkbox]:checked").length;
                        
                    var oProperties = Utilities.CSVToProperties($scope.property, (bChecked)?$scope.checked:$scope.unchecked);

                    StylesheetModifier.changeStyleBySelector($scope.stylesheet, $scope.selector, oProperties);
                });
            }
        };
    }
);


angular.module('genesys.css-inputs').directive(

    'genesysPresetPicker',

    function(StylesheetModifier, Utilities){

        return {

            templateUrl: "src/js/genesys.css-inputs/templates/preset-picker.html",
            restrict: 'E',
            replace: true,
            scope: true,
            link: function($scope, ndPresetPicker, attrs){
                
                $scope.label = attrs.label;

                $(ndPresetPicker).find("> label > select").change(function(){

                    var bReplay = !!$(ndPresetPicker).find("> label > input:checked").length;

                    StylesheetModifier[(bReplay)?"replay":"applyPreset"](window.oPresets[this.value]);
                });
            }
        };
    }
);











angular.module('genesys.css-inputs').directive(

    'noButton',

    function(){

        return {

            restrict: 'A',
            link: function($scope, element, attrs){

                element.find("> button").hide();
            }   
        };
    }
);

angular.module('genesys.css-inputs').directive(

    'float',

    function(){

        return {

            restrict: 'A',
            link: function($scope, element, attrs){

                $scope.float = true;
            }   
        };
    }
);

angular.module('genesys.css-inputs').directive(

    'stylesheet',

    function(){

        return {

            restrict: 'A',
            link: function($scope, element, attrs){

                $scope.stylesheet = true;
            }   
        };
    }
);

angular.module('genesys.css-inputs').directive(

    'genesysCssInputGroup',

    function(StylesheetModifier){

        return {

            restrict: 'A',
            link: function($scope, element, attrs){

                $scope.stylesheet = attrs.stylesheet;

                StylesheetModifier.setStylesheet($scope.stylesheet);
            }   
        };
    }
);