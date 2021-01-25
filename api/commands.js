const self = {
  find_touchscreen_id: {
    params: {
      display: ':0'
    },
    run o => `
      ids=$(DISPLAY=${o.display} xinput --list | awk -v search="$1" \
          '$0 ~ search {match($0, /id=[0-9]+/);\
                        if (RSTART) \
                          print substr($0, RSTART+3, RLENGTH-3)\
                       }'\
           )

      for i in $ids
      do
        echo $i
      done
    `
  },
  pkill: {
    params: {
      name: ''
    }
    run: o => `pkill -9 ${o.name}`
  },
  kiosk: {
    params: {
      display: ':0',
      touchscreen: find_touchscreen_id(),
      pinch: false,
      incognito: true,
      address: ''
    },
    run: o => `
      DISPLAY=${o.display} chromium-browser --kiosk --disable-features=TranslateUI --touch-devices=${o.touchscreen} --check-for-update-interval=31536000 --app-auto-launched ${ pinch ? '' : '--disable-pinch'} ${o.incognito ? '--incognito' : ''} --noerrdialogs --disable-suggestions-service --disable-translate --disable-save-password-bubble --disable-session-crashed-bubble --disable-infobars --app=${o.address}
    `
  }

}

// rm -rf ~/.config/chromium/Singleton*

module.exports = self