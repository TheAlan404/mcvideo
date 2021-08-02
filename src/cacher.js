const ProtoDef = require('protodef').ProtoDef
const Serializer = require('protodef').Serializer
const Parser = require('protodef').Parser
const fs = require('fs')
const Msg = require('./inGameUtils/Msg')

const CacheProto = {
  i32: 'native',
  frame: [
    'buffer',
    {
      countType: 'i32'
    }
  ],
  cache: [
    'array',
    {
      countType: 'i32',
      type: 'frame'
    }
  ]
}

// const proto = new ProtoDef()
// proto.addTypes(CacheProto)

module.exports = class Cacher {
  constructor (mplayer) {
    this.mplayer = mplayer
  };

  async saveToCache () {
    return 'disabled'
    if (this.mplayer.frames.length === 0) return console.log('nothing to save')
    const fpath = './cached/' + this.mplayer.videoID + '_data'
    const file = fs.createWriteStream(fpath)
    this.mplayer.serv.chat(new Msg('[i] Saving ' + this.mplayer.frames.length + ' frames...'))
    console.log('[i] Saving ' + this.mplayer.frames.length + ' frames...')

    const serializer = new Serializer(proto, 'cache')
    serializer.pipe(file)
    await new Promise((res) => {
      serializer.write(this.mplayer.frames, null, () => res())
    })

    console.log('[i] Saving complete!')
    this.mplayer.serv.chat(new Msg('[i] Saving completed.'))
    return true
  };

  async loadFromCache (videoID) {
    return 'disabled'
    const fpath = './cached/' + videoID + '_data'
    console.log(fpath)
    const file = fs.createReadStream(fpath)
    this.mplayer.frames = []
    file.once('readable', async () => { // like this?
      this.mplayer.serv.chat(new Msg('[i] Loading from cache...'))
      console.log('[i] Loading from cache...')

      const parser = new Parser(proto, 'cache')
      file.pipe(parser)

      parser.once('data', (data) => { // is this how we do it...?
        console.log(data)
        this.mplayer.serv.chat(new Msg('[i] Loading completed'))
        console.log('[i] Loading complete')
        this.mplayer.start()
      })
    })
  };

  hasInCache (videoID) {
    const _ = './cached/' + videoID
    return fs.existsSync(_ + '_data')
  };
}
