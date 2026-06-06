import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useRepositories } from "../../data/repositoryProvider";
import { getHighMelRatio } from "../../domain/balloonParams";
import type { BalloonGift, GiftRoom } from "../../domain/types";

function recipientUrl(token: string) {
  return `${window.location.origin}/r/${token}`;
}

function recipientPath(token: string) {
  return `/r/${token}`;
}

function formatNumber(value: number, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : "0.00";
}

function createAudioAnalysisRows(gift: BalloonGift) {
  const { audioFeatures, voiceSignature } = gift.balloonParams;
  const highMelRatio = getHighMelRatio(audioFeatures.melBands);

  return [
    {
      metric: "时长",
      extracted: `${formatNumber(audioFeatures.durationSec, 1)} 秒`,
      mapped: `半径 ${formatNumber(gift.balloonParams.radius, 1)}px`
    },
    {
      metric: "频率中心",
      extracted: `${Math.round(audioFeatures.spectralCentroid)} Hz`,
      mapped: `明度 ${formatNumber(gift.balloonParams.lightness, 1)}%`
    },
    {
      metric: "能量",
      extracted: formatNumber(audioFeatures.rmsEnergy, 3),
      mapped: `发光 ${formatNumber(gift.balloonParams.glow, 2)}`
    },
    {
      metric: "语速代理",
      extracted: `${formatNumber(audioFeatures.speechRate, 2)} 次/秒`,
      mapped: `运动 ${formatNumber(gift.balloonParams.floatSpeed, 2)}`
    },
    {
      metric: "Mel 高频占比",
      extracted: formatNumber(highMelRatio, 2),
      mapped: `尖角 ${gift.balloonParams.spikeCount} 个`
    },
    {
      metric: "声纹轮廓",
      extracted: `${voiceSignature.waveformContour.length} 点`,
      mapped: "内部声纹线"
    },
    {
      metric: "能量包络",
      extracted: `${voiceSignature.energyEnvelope.length} 帧`,
      mapped: "呼吸与发光脉冲"
    },
    {
      metric: "节奏密度",
      extracted: `${formatNumber(voiceSignature.rhythmDensity, 2)} 峰/秒`,
      mapped: `漂浮 ${formatNumber(gift.balloonParams.floatSpeed, 2)}`
    },
    {
      metric: "停顿模式",
      extracted: `${voiceSignature.pausePattern.length} 段`,
      mapped: "停顿式摆动"
    },
    {
      metric: "动态范围",
      extracted: formatNumber(voiceSignature.dynamicRange, 2),
      mapped: `弹性 ${formatNumber(gift.balloonParams.wobble, 2)}`
    },
    {
      metric: "色相",
      extracted: "用户选择",
      mapped: `${gift.balloonParams.hue}°`
    }
  ];
}

export function ManageRoom({ room: initialRoom }: { room: GiftRoom }) {
  const { rooms, gifts } = useRepositories();
  const [room, setRoom] = useState(initialRoom);
  const [giftList, setGiftList] = useState<BalloonGift[]>([]);
  const [error, setError] = useState("");

  async function refresh() {
    setGiftList(await gifts.listActiveGifts({ roomId: room.id, manageToken: room.manageToken }));
  }

  useEffect(() => {
    let active = true;

    async function loadGifts() {
      try {
        const activeGifts = await gifts.listActiveGifts({ roomId: room.id, manageToken: room.manageToken });
        if (active) setGiftList(activeGifts);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "读取气球失败");
      }
    }

    void loadGifts();
    return () => {
      active = false;
    };
  }, [gifts, room.id, room.manageToken]);

  async function deleteGift(gift: BalloonGift) {
    setError("");
    await gifts.deleteGift({ giftId: gift.id, manageToken: room.manageToken });
    await refresh();
  }

  async function publish() {
    setError("");
    if (giftList.length === 0) {
      setError("至少收到一个气球后再发布收礼链接。");
      return;
    }
    const published = await rooms.publishRoom(room.manageToken);
    setRoom(published);
  }

  const publishDisabled = room.status === "published" || giftList.length === 0;

  return (
    <section className="panel manage-room">
      <div className="manage-room-header">
        <div>
          <h2>{room.title}</h2>
          <p>收礼者：{room.recipientName}</p>
        </div>
        <button type="button" onClick={publish} disabled={publishDisabled}>
          {room.status === "published" ? "已发布收礼链接" : "发布收礼链接"}
        </button>
      </div>

      {error ? <p className="error-text">{error}</p> : null}
      {giftList.length === 0 && room.status !== "published" ? (
        <p className="muted-text">至少收到一个气球后再发布收礼链接。</p>
      ) : null}

      {giftList.length === 0 ? (
        <p>当前没有有效气球</p>
      ) : (
        <ul className="gift-list">
          {giftList.map((gift) => (
            <li key={gift.id}>
              <div className="gift-list-summary">
                <strong>{gift.giverName}</strong>
                <span>{gift.editedTranscript || gift.transcript || gift.extraText || "一段语音祝福"}</span>
              </div>
              <table className="audio-analysis-table" aria-label={`${gift.giverName} 的声频数据分析`}>
                <thead>
                  <tr>
                    <th>指标</th>
                    <th>提取数据</th>
                    <th>映射结果</th>
                  </tr>
                </thead>
                <tbody>
                  {createAudioAnalysisRows(gift).map((row) => (
                    <tr key={row.metric}>
                      <th scope="row">{row.metric}</th>
                      <td>{row.extracted}</td>
                      <td>{row.mapped}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button type="button" onClick={() => deleteGift(gift)} aria-label={`删除 ${gift.giverName} 的气球`}>
                删除
              </button>
            </li>
          ))}
        </ul>
      )}

      {room.status === "published" ? (
        <div className="recipient-link">
          <strong>收礼链接</strong>
          <p>
            <Link to={recipientPath(room.recipientToken)}>{recipientUrl(room.recipientToken)}</Link>
          </p>
        </div>
      ) : null}
    </section>
  );
}
