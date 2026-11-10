// Dữ liệu mẫu cho chế độ ?demo (lời bài hát chỉ là văn bản minh hoạ tự viết)

const JP = `月明かりの坂道を
ひとり歩いてゆく
風が運ぶ鈴の音
遠い夢を呼んでいる

花びら舞う境内で
君の名前をなぞる
忘れないで　この夜を
幻想の向こう側で`;

const RM = `tsukiakari no sakamichi wo
hitori aruite yuku
kaze ga hakobu suzu no ne
tooi yume wo yondeiru

hanabira mau keidai de
kimi no namae wo nazoru
wasurenaide kono yoru wo
gensou no mukougawa de`;

const VI = `Trên con dốc ngập ánh trăng
Một mình em bước đi
Tiếng chuông gió mang theo
Đang gọi giấc mơ xa xôi

Giữa sân đền cánh hoa bay
Em lần theo tên người
Xin đừng quên đêm nay
Ở phía bên kia ảo mộng`;

const VI_MISMATCH = VI.replace('Em lần theo tên người', 'Em lần theo\ntên người');

const SAMPLES = [
  ['月夜の鈴', 'Tsukiyo no Suzu', 'Chuông đêm trăng', 'FELT', 'Spatial Moving', 'Comiket 89', '東方永夜抄', 'Maika'],
  ['花籠の夢', 'Hanakago no Yume', 'Giấc mơ giỏ hoa', 'EastNewSound', 'Rebirth StoryⅢ', 'Comiket 91', '東方花映塚', 'みぃ'],
  ['紅い霧の向こう', 'Akai Kiri no Mukou', 'Bên kia màn sương đỏ', 'SOUND HOLIC', 'Pure Heart', 'Comiket 95', '東方紅魔郷', 'つぅ'],
  ['風の祝詞', 'Kaze no Norito', 'Lời chúc của gió', 'DiGiTAL WiNG', 'Milky Wink', 'Comiket 97', '東方風神録', '花たん'],
  ['夢見る人形', 'Yumemiru Ningyou', 'Búp bê mộng mơ', 'Eurobeat Union', 'TOHO EURO TRIGGER VOL.31', 'Comiket 95', '東方夢時空', 'ferret'],
  ['霊廟の灯', 'Reibyou no Hi', 'Ngọn đèn lăng mộ', '凋叶棕', '望', 'Comiket 91', '東方神霊廟', 'めらみぽっぷ'],
  ['憑依の華', 'Hyoui no Hana', 'Đoá hoa nhập hồn', '凋叶棕', '憑', 'Comiket 97', '東方憑依華', '美津紀'],
  ['獣道', 'Kemonomichi', 'Lối thú hoang', 'TUMENECO', 'START', 'Comiket 97', '東方鬼形獣', 'NU-KO'],
  ['封魔の詩', 'Fuuma no Uta', 'Khúc phong ma', 'K2E†Cradle', 'Fluster Escape', 'Comiket 89', '東方封魔録', '瑶山百霊'],
  ['心の仮面', 'Kokoro no Kamen', 'Mặt nạ trái tim', 'Yonder Voice', 'バンパイアメイト', 'Comiket 95', '東方心綺楼', 'Maika'],
  ['偶像の夜明け', 'Guuzou no Yoake', 'Bình minh thần tượng', 'GET IN THE RING', '偶像ハルマゲドン', 'Comiket 97', 'Original!', 'つぅ'],
  ['紺碧の海', 'Konpeki no Umi', 'Biển xanh thẳm', '紺碧Studio', 'Spatial Moving', 'Comiket 91', '東方紅魔郷', 'みぃ'],
  ['ちいさな約束', 'Chiisana Yakusoku', 'Lời hứa nhỏ', 'ちょこふぁん', 'Pure Heart', 'Comiket 89', '東方永夜抄', '花たん'],
];

const PALETTE = [
  ['#6a5acd', '#f78fb3'],
  ['#e66767', '#f5cd79'],
  ['#3dc1d3', '#546de5'],
  ['#20bf6b', '#0fb9b1'],
  ['#a55eea', '#4b7bec'],
  ['#fa8231', '#eb3b5a'],
];

function cover(ch, i) {
  const [a, b] = PALETTE[i % PALETTE.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
    <rect width="600" height="600" fill="url(#g)"/>
    <circle cx="460" cy="140" r="90" fill="rgba(255,255,255,.18)"/>
    <text x="300" y="370" text-anchor="middle" font-size="260" font-family="serif" fill="rgba(255,255,255,.92)">${ch}</text>
  </svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

export function demoSeed() {
  const files = { 'meta.json': { colors: {} } };
  const index = [];
  const base = Date.UTC(2025, 3, 2);
  SAMPLES.forEach(([jp, rm, vi, circle, album, event, source, vocal], i) => {
    const id = `demo-${String(i + 1).padStart(2, '0')}`;
    const created = new Date(base + i * 23 * 86400000).toISOString();
    const p = {
      id,
      titleJP: jp,
      titleRM: rm,
      titleVI: vi,
      circle: i === 3 ? [circle, 'FELT'] : [circle],
      album: [album],
      release: created.slice(0, 10),
      event: [event],
      arrangement: [['NAGI☆', 'TTL', 'タロー', 'アルノ', 'litterzy', 'RD-Sounds', '709sec'][i % 7]],
      lyricist: [['Mika', 'NANA', 'やそ', 'kari*n', '蒼羅杏', 'oto itsuki'][i % 6]],
      vocals: [vocal],
      originalTitle: [['少女綺想曲 ～ Dream Battle', '風神少女', 'おてんば恋娘', '上海紅茶館　～ Chinese Tea', 'Original!'][i % 5]],
      source: [source],
      cover: i === 5 ? '' : `media/${id}-cover.svg`,
      youtube: '',
      audio: '',
      audioName: '',
      lyrics: { jp: JP, rm: i % 4 === 2 ? '' : RM, vi: i === 1 ? VI_MISMATCH : VI },
      other:
        i === 0
          ? '**Ghi chú dịch**\n\n- *鈴の音* (suzu no ne): tiếng chuông nhỏ treo ở đền.\n- Xem thêm: https://example.com\n\n> Đây là dữ liệu demo.\n\n<script>alert(1)</script> ← phải hiện dạng chữ'
          : '',
      comment: i === 0 ? 'Bài demo đầu tiên. Có thể **sửa**, _xoá_ và khôi phục trong chế độ demo.' : '',
      createdAt: created,
      updatedAt: created,
      trashedAt: null,
      version: 1,
    };
    files[`posts/${id}.json`] = p;
    if (p.cover) files[p.cover] = cover([...jp][0], i);
    index.push({ id, updatedAt: created });
  });
  files['index.json'] = index;
  return files;
}
