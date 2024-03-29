class Msg {
	constructor(text, color, hover, click, suggest){
		if(text) this.text(text);
		if(color) this.color(color);
		if(hover) this.hover(hover);
		if(click) this.click(click);
		if(suggest) this.suggest(suggest);
		return this;
	};
	text(t){
		this._text = t;
		return this;
	};
	color(color){
		this._color = color;
		return this;
	};
	hover(text){
		this._hover = text;
		return this;
	};
	suggest(text){
		this._click = text;
		this._clickAction = "suggest_command";
		return this;
	};
	click(text){
		this._click = text;
		this._clickAction = "run_command";
		if(text.startsWith("http")) this._clickAction = "open_url";
		return this;
	};
	toJSON(){
		return {
			text: this._text,
			color: this._color,
			hoverEvent: this._hover ? {
				action: "show_text",
				value: this._hover,
			} : undefined,
			clickEvent: this._click ? {
				action: this._clickAction,
				value: this._click,
			} : undefined,
		};
	};
};



module.exports = Msg;