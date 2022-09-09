import {
    isValidValueString,
    getValueObjectFromString,
    getValueStringFromValueObject,
    normalizeMinMaxDate,
    isValidDateString,
    isValidTimeString
} from "./utils";
import {
    extend,
    clon,
    isPlainObject,
    isString,
    isUndefined
} from "./utils/object";
import {
    getScrollParent,
    getEventTarget,
    containsDom,
    triggerEvent,
    createElement
} from "./utils/dom";
import {
    jalaliToday
} from "./utils/jalali";
import {
    CONTAINER_ELM_QUERY,
    OVERLAY_ELM_QUERY,
    EVENT_FOCUS_STR,
    EVENT_CHANGE_INPUT_STR,
    MIN_MAX_TODAY_SETTING,
    MIN_MAX_ATTR_SETTING,
    MIN_MAX_ATTR_SETTING_MAX_ATTR_NAME,
    MIN_MAX_ATTR_SETTING_MIN_ATTR_NAME,
    ONLY_DATE_ATTR_SETTING_MAX_ATTR_NAME,
    ONLY_TIME_ATTR_SETTING_MAX_ATTR_NAME,
    STYLE_VISIBILITY_VISIBLE,
    STYLE_VISIBILITY_HIDDEN,
    STYLE_DISPLAY_BLOCK,
    STYLE_DISPLAY_HIDDEN,
    STYLE_POSITION_FIXED
} from "./constants";
import draw from "./draw";
import defaults from "./defaults";

const jalaliDatepicker = {
    init(options) {
        this.updateOptions(options);
        window.onresize = windowResize;
        if (this.options.autoHide) document.body.onclick = documentClick;
        if (this.options.autoShow) addEventListenerOnInputs(this.options.selector);
    },
    updateOptions(options){
        this.options = normalizeOptions(options);
    },
    options: defaults,
    input: null,
    get dpContainer() {
        if(!this._dpContainer){
            this._dpContainer = createElement(CONTAINER_ELM_QUERY, this.options.container);
            this.overlayElm = createElement(OVERLAY_ELM_QUERY, this.options.container);
            
            this.dpContainer.style.zIndex = this.options.zIndex;
            this.overlayElm.style.zIndex = this.options.zIndex-1;
        }
        return this._dpContainer;
    },
    get today() {
        this._today = this._today || this.options.today || jalaliToday();
        return this._today;
    },
    get inputValue() {
        let inputValue = clon(this.input.value);

        if (isValidValueString(this, inputValue)) {
            inputValue = getValueObjectFromString(this, inputValue);
        } 
        else if (isString(inputValue) && isValidDateString(this, inputValue)) {
            inputValue = getValueObjectFromString(this, inputValue);
        }
        else {
            inputValue = {};
        }

        return inputValue;
    },
    get initDate() {
        if(this._initDate){
            return this._initDate;
        }
        this._initDate = clon(this.input.value) || {};

        if (isPlainObject(this._initDate)) {
            this._initDate = this.options.initDate || clon(this.today);
        }
        else if (isString(this._initDate) && isValidDateString(this, this._initDate)) {
            this._initDate = getValueObjectFromString(this, this._initDate);
        }else{
            this._initDate = clon(this.today);
        }
        this._initDate=normalizeMinMaxDate(this,this._initDate);
        return this._initDate;
    },
    get initTime() {
        const defaultInit={
            hour:0,minute:0,second:0
        };
        this._initTime = this._initTime || clon(this.input.value) || this.options.initTime || defaultInit;

        if (isString(this._initTime)) {
            if (isValidTimeString(this, this._initTime)) {
                this._initTime = getValueObjectFromString(this, this._initTime);
                this._initTime=extend(this._initTime,defaultInit);
            }else{
                this._initTime = defaultInit;
            }
        }
        return this._initTime;
    },
    _draw: draw,
    show(input) {
        this._initDate = null;
        this._initTime = null;
        this._value = null;
        this.input = input;
        this._draw();
        this.dpContainer.style.visibility = STYLE_VISIBILITY_VISIBLE;
        this.dpContainer.style.display = STYLE_DISPLAY_BLOCK;
        setTimeout(() => {
            this.overlayElm.style.display = STYLE_DISPLAY_BLOCK;
        }, 50);
        this.setPosition();
        setScrollOnParent(input);
        setReadOnly(input, this.options);
    },
    hide() {
        this.dpContainer.style.visibility = STYLE_VISIBILITY_HIDDEN;
        this.dpContainer.style.display = STYLE_DISPLAY_HIDDEN;
        this.overlayElm.style.display = STYLE_DISPLAY_HIDDEN;
    },
    setPosition() {
        if (this.dpContainer.style.visibility !== STYLE_VISIBILITY_VISIBLE) {
            return;
        }
        const inputBounds = this.input.getBoundingClientRect();
        const inputHeight = inputBounds.height;
        let left = inputBounds.left;
        let top = inputBounds.top + inputHeight;
        top += this.options.topSpace;
        const windowWidth = window.document.body.offsetWidth;
        const dpContainerWidth = this.dpContainer.offsetWidth;
        const dpContainerHeight = this.dpContainer.offsetHeight;

        if (left + dpContainerWidth >= windowWidth) {
            left -= (left + dpContainerWidth) - (windowWidth + 10);
        }
        if (top - inputHeight >= dpContainerHeight && top + dpContainerHeight >= window.innerHeight) {
            top -= dpContainerHeight + inputHeight + this.options.bottomSpace + this.options.topSpace;
        }
        this.dpContainer.style.position = STYLE_POSITION_FIXED;
        this.dpContainer.style.left = left + "px";
        this.dpContainer.style.top = top + "px";
    },
    get getValue() {
        this._value = this._value || this.inputValue || {};
        return this._value;
    },
    setValue(objValue) {
        this._value = extend({
            year: this.today.year,
            month: this.today.month,
            day: this.today.day,
            hour: this.initTime.hour,
            minute: this.initTime.minute,
            second: this.initTime.second
        }, extend(this._value, objValue));

        this.input.value = getValueStringFromValueObject(this, this._value);
        triggerEvent(this.input, EVENT_CHANGE_INPUT_STR);
        if (!this.options.time) {
            this.hide();
        } else {
            this._draw();
        }
    },
    increaseMonth() {
        const isLastMonth = this._initDate.month === 12;
        if (this.options.changeMonthRotateYear && isLastMonth) {
            this.increaseYear();
        }
        this.monthChange(isLastMonth ? 1 : this._initDate.month + 1);
    },
    decreaseMonth() {
        const isFirstMonth = this._initDate.month === 1;
        if (this.options.changeMonthRotateYear && isFirstMonth) {
            this.decreaseYear();
        }
        this.monthChange(isFirstMonth ? 12 : this._initDate.month - 1);
    },
    monthChange(month) {
        this._initDate = normalizeMinMaxDate(this,this._initDate,{month});
        this._draw();
    },
    increaseYear() {
        this.yearChange(this._initDate.year + 1);
    },
    decreaseYear() {
        this.yearChange(this._initDate.year - 1);
    },
    yearChange(year) {
        this._initDate = normalizeMinMaxDate(this,this._initDate,{year});
        this._draw();
    }
};

const getDefaultFromAttr = (attrName) => {
    let dateAttrVal = jalaliDatepicker.input?.getAttribute(attrName);
    if (dateAttrVal === MIN_MAX_TODAY_SETTING) {
        dateAttrVal = clon(jalaliDatepicker.today);
    } else if (isString(dateAttrVal)) {
        try {
            dateAttrVal = document.querySelector(dateAttrVal).value;
        } catch {
            //
        }

        if (isValidDateString(jalaliDatepicker, dateAttrVal)) {
            dateAttrVal = getValueObjectFromString(jalaliDatepicker, dateAttrVal);
        } else {
            dateAttrVal = {};
        }
    } else {
        dateAttrVal = {};
    }
    return dateAttrVal;
};

const normalizeOptions = (options) => {
    if(!isUndefined(jalaliDatepicker.options._date) && isUndefined(options.date)){
        options.date=jalaliDatepicker.options._date;
    }
    if(!isUndefined(jalaliDatepicker.options._time) && isUndefined(options.time)){
        options.time=jalaliDatepicker.options._time;
    }
    options.separatorChars=extend(jalaliDatepicker.options.separatorChars,options.separatorChars);
    options=extend({},jalaliDatepicker.options, options);
    if (options.minDate === MIN_MAX_TODAY_SETTING) options.minDate = clon(jalaliDatepicker.today);
    if (options.maxDate === MIN_MAX_TODAY_SETTING) options.maxDate = clon(jalaliDatepicker.today);

    if (options.minDate === MIN_MAX_ATTR_SETTING || options._minDateIsAttr) {
        delete options.minDate;
        options._minDateIsAttr = true;
        window.Object.defineProperty(options, "minDate", {
            get: () => {
                return getDefaultFromAttr(MIN_MAX_ATTR_SETTING_MIN_ATTR_NAME);
            },
            enumerable:true
        });
    }
    if (options.maxDate === MIN_MAX_ATTR_SETTING || options._maxDateIsAttr) {
        delete options.maxDate;
        options._maxDateIsAttr = true;
        window.Object.defineProperty(options, "maxDate", {
            get: () => {
                return getDefaultFromAttr(MIN_MAX_ATTR_SETTING_MAX_ATTR_NAME);
            },
            enumerable:true
        });
    }

    options._date=options.date;
    delete options.date;
    window.Object.defineProperty(options, "date", {
        get: () => {
            return options._date && !jalaliDatepicker.input?.hasAttribute(ONLY_TIME_ATTR_SETTING_MAX_ATTR_NAME);
        },
        enumerable:true
    });

    options._time=options.time;
    delete options.time;
    window.Object.defineProperty(options, "time", {
        get: () => {
            return options._time && !jalaliDatepicker.input?.hasAttribute(ONLY_DATE_ATTR_SETTING_MAX_ATTR_NAME);
        },
        enumerable:true
    });

    return options;
};

function documentClick(e) {
    if (jalaliDatepicker.dpContainer.style.visibility !== STYLE_VISIBILITY_VISIBLE ||
        containsDom(jalaliDatepicker.dpContainer, e) ||
        getEventTarget(e) === jalaliDatepicker.input
    ) {
        return;
    }
    jalaliDatepicker.hide();
}

function windowResize() {
    jalaliDatepicker.setPosition();
}

function setScrollOnParent(input) {
    getScrollParent(input).addEventListener("scroll", function () {
        jalaliDatepicker.setPosition();
    }, {
        passive: true
    });
}

function setReadOnly(input, options) {
    if (options.autoReadOnlyInput && !input.readOnly) input.readOnly = true;
}

function addEventListenerOnInputs(querySelector) {
    Element.prototype.matches =
        Element.prototype.matchesSelector ||
        Element.prototype.mozMatchesSelector ||
        Element.prototype.msMatchesSelector ||
        Element.prototype.oMatchesSelector ||
        Element.prototype.webkitMatchesSelector;
    document.body.addEventListener(EVENT_FOCUS_STR, (e) => {
        if (e.target && e.target.matches(querySelector)) {
            jalaliDatepicker.show(e.target);
        }
    });
}

window.jalaliDatepicker = {
    startWatch(options = {}) {
        jalaliDatepicker.init(options);
    },
    show(input) {
        jalaliDatepicker.show(input);
    },
    hide() {
        jalaliDatepicker.hide();
    },
    updateOptions(options){
        jalaliDatepicker.updateOptions(options);
    }
};