// -------------------------------------------------------------------
// markItUp!
// -------------------------------------------------------------------
// Copyright (C) 2008 Jay Salvat
// http://markitup.jaysalvat.com/
// -------------------------------------------------------------------
// ReStructured Text
// http://docutils.sourceforge.net/
// http://docutils.sourceforge.net/rst.html
// -------------------------------------------------------------------
// Mark Renron <indexofire@gmail.com>
// http://www.indexofire.com
// -------------------------------------------------------------------
// Jannis Leidel <jannis@leidel.info>
// http://enn.io
// -------------------------------------------------------------------
mySettings = {
	nameSpace: 'ReST',
	onShiftEnter: {keepDefault:false, openWith:'\n\n'},
	onTab: {keepDefault:false, replaceWith:'    '},
	markupSet: [
		{name:'Level 1 Heading', key:'1', placeHolder:'Your title Here...', closeWith:function(markItUp) { return miu.markdownTitle(markItUp, '#'); } },
		{name:'Level 2 Heading', key:'2', placeHolder:'Your title here...', closeWith:function(markItUp) { return miu.markdownTitle(markItUp, '*'); } },
		{name:'Level 3 Heading', key:'3', placeHolder:'Your title here...', closeWith:function(markItUp) { return miu.markdownTitle(markItUp, '='); } },
		{name:'Level 4 Heading', key:'4', placeHolder:'Your title here...', closeWith:function(markItUp) { return miu.markdownTitle(markItUp, '-'); } },
		{name:'Level 5 Heading', key:'5', placeHolder:'Your title here...', closeWith:function(markItUp) { return miu.markdownTitle(markItUp, '^'); } },
		{name:'Level 6 Heading', key:'6', placeHolder:'Your title here...', closeWith:function(markItUp) { return miu.markdownTitle(markItUp, '"'); } },
		{separator:'---------------' },
		{name:'Bold', key:'B', openWith:'**', closeWith:'**', placeHolder:'Input Your Bold Text Here...'},
		{name:'Italic', key:'I', openWith:'`', closeWith:'`', placeHolder:'Input Your Italic Text Here...'},
		{separator:'---------------' },
		{name:'Bulleted List', openWith:'- ' },
		{name:'Numeric List', openWith:function(markItUp) { return markItUp.line+'. '; } },
		{separator:'---------------' },
		{name:'Picture', key:'P', openWith:'.. image:: ', placeHolder:'Link Your Images Here...'},
		{name:'Link', key:"L", openWith:'`', closeWith:'`_ \n\n.. _`Link Name`: [![Url:!:http://]!]', placeHolder:'Link Name' },
		{name:'Quotes', openWith:'    '},
		{name:'Code', openWith:'\n:: \n\n	 '},
		{name:'Preview', className:'preview', call:'preview'}
	]
};

// mIu nameSpace to avoid conflict.
miu = {
	markdownTitle: function(markItUp, character) {
		heading = '';
		n = $.trim(markItUp.selection||markItUp.placeHolder).length;
		for(i = 0; i < n; i++) {
			heading += character;
		}
		return '\n'+heading;
	}
};
