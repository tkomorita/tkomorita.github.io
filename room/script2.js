const Peer = window.Peer;

(async function main() {
  const localVideo = document.getElementById('js-local-stream');
  const joinTrigger = document.getElementById('js-join-trigger');
  const leaveTrigger = document.getElementById('js-leave-trigger');
  const remoteVideos = document.getElementById('js-remote-streams');
  const roomId = document.getElementById('js-room-id');
  const roomMode = document.getElementById('js-room-mode');
  const localText = document.getElementById('js-local-text');
  const sendTrigger = document.getElementById('js-send-trigger');
  const messages = document.getElementById('js-messages');
  const joinMessages = document.getElementById('join-messages');
  const meta = document.getElementById('js-meta');
  const sdkSrc = document.querySelector('script[src*=skyway]');

  const myVideo = document.getElementById('my_video_base');
  const theirVideo = document.getElementById('their_video_base');

  myVideo.addEventListener('click', (e) =>{
    console.log("click myVideo");
    console.log(e.pageX);
    e.preventDefault();
  });
  
  theirVideo.addEventListener('click', (e) => {
    console.log("click theirVideo");
    console.log(e.pageX);
    e.preventDefault();
  })
  

  meta.innerText = `
    UA: ${navigator.userAgent}
    SDK: ${sdkSrc ? sdkSrc.src : 'unknown'}
  `.trim();

  const getRoomModeByHash = () => (location.hash === '#sfu' ? 'sfu' : 'mesh');

  roomMode.textContent = getRoomModeByHash();
  window.addEventListener(
    'hashchange',
    () => (roomMode.textContent = getRoomModeByHash())
  );

  const localStream = await navigator.mediaDevices
    .getUserMedia({
      audio: true,
      video: true,
    })
    .catch(() => {
      
      alert("ERROR:カメラが見つかりません。");
      console.error;

    });

  // Render local stream
  localVideo.muted = true;
  localVideo.srcObject = localStream;
  localVideo.playsInline = true;
  await localVideo.play().catch(console.error);

  // eslint-disable-next-line require-atomic-updates
  const peer = (window.peer = new Peer({
    key: window.__SKYWAY_KEY__,
    debug: 3,
  }));

    //PeerID取得
    peer.on('open', () => {
        console.log("peer.om('open') ID = " + peer.id);
        document.getElementById('my-id').textContent = peer.id;
    });

    // 発信処理
    document.getElementById('make-call').onclick = () => {
      const theirID = document.getElementById('their-id').value;
      const mediaConnection = peer.call(theirID, localStream);
      setEventListener(mediaConnection);


      const remoteVideo = document.getElementById('their-video');
      const closeTrigger = document.getElementById('js-close-trigger');
      closeTrigger.addEventListener('click', () => mediaConnection.close(true));
      mediaConnection.once('close', () => {
          remoteVideo.srcObject.getTracks().forEach(track => track.stop());
          remoteVideo.srcObject = null;
      });

    };

    // イベントリスナを設置する関数
    const setEventListener = mediaConnection => {
      mediaConnection.on('stream', stream => {
          // video要素にカメラ映像をセットして再生
          const videoElm = document.getElementById('their-video')
          videoElm.srcObject = stream;
          
          videoElm.play();
      });
    }

    //着信処理
    peer.on('call', mediaConnection => {
      mediaConnection.answer(localStream);
      setEventListener(mediaConnection);
    });











  // Register join handler
  joinTrigger.addEventListener('click', () => {
    // Note that you need to ensure the peer has connected to signaling server
    // before using methods of peer instance.
    if (!peer.open) {
      return;
    }

    const room = peer.joinRoom(roomId.value, {
      mode: getRoomModeByHash(),
      stream: localStream,
    });

    room.once('open', () => {
      messages.textContent += '=== You joined ===\n';
      joinMessages.textContent = "＜入出中＞";
    });
    room.on('peerJoin', peerId => {
      messages.textContent += `=== ${peerId} joined ===\n`;
    });

    // Render remote stream for new peer join in the room
    room.on('stream', async stream => {

      const newDiv = document.createElement('div');
      newDiv.setAttribute("class", "box");
      newDiv.addEventListener('click', (e) => {
        console.log("click newDiv");
        document.getElementById('their-id').value = stream.peerId;
      });

      const newVideo = document.createElement('video');
      newVideo.srcObject = stream;
      newVideo.muted = true;
      newVideo.playsInline = true;
      // mark peerId to find it later at peerLeave event
      newVideo.setAttribute('data-peer-id', stream.peerId);
      // newVideo.setAttribute('width', '200px');
      newVideo.setAttribute('class', 'video_base_min');

      // newVideo.addEventListener('click', (e) => {
      //   console.log("click newVideo");
      //   document.getElementById('their-id').value = stream.peerId;
      // });

      newDiv.append(newVideo);

      const newP = document.createElement('p');
      newP.setAttribute("class", "text_center");
      const newText = document.createTextNode(stream.peerId);
      newP.appendChild(newText);

      newDiv.append(newP);

      remoteVideos.append(newDiv);
      await newVideo.play().catch(console.error);
    });

    room.on('data', ({ data, src }) => {
      // Show a message sent to the room and who sent
      messages.textContent += `${src}: ${data}\n`;
    });

    // for closing room members
    room.on('peerLeave', peerId => {
      const remoteVideo = remoteVideos.querySelector(
        `[data-peer-id=${peerId}]`
      );
      remoteVideo.srcObject.getTracks().forEach(track => track.stop());
      remoteVideo.srcObject = null;
      remoteVideo.remove();

      messages.textContent += `=== ${peerId} left ===\n`;
    });

    // for closing myself
    room.once('close', () => {
      sendTrigger.removeEventListener('click', onClickSend);
      messages.textContent += '== You left ===\n';
      joinMessages.textContent = "＜退出中＞";
      Array.from(remoteVideos.children).forEach(remoteVideo => {
        remoteVideo.srcObject.getTracks().forEach(track => track.stop());
        remoteVideo.srcObject = null;
        remoteVideo.remove();
      });
    });

    sendTrigger.addEventListener('click', onClickSend);
    leaveTrigger.addEventListener('click', () => room.close(), { once: true });

    function onClickSend() {
      // Send message to all of the peers in the room via websocket
      room.send(localText.value);

      messages.textContent += `${peer.id}: ${localText.value}\n`;
      localText.value = '';
    }
  });

  peer.on('error', console.error);
})();