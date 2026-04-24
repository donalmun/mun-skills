# Flavor Text — Vietnamese Humor for Gemini Review Skills

> **Tone**: Savage mode — trash-talk thân thiện, Vietnamese dev slang, gaming culture
> **Format**: Display as `> {emoji} {message}` blockquote
> **Rules**: Pick random from pool, NEVER repeat same message within 1 session. Replace `{N}`, `{TOTAL}`, `{ROUND}` with actual values.

---

## 1. SKILL_START
> Trigger: Skill bắt đầu chạy

- `> 💎 Oke, vào trận thôi. Gemini à, hôm nay anh nhẹ tay nha~`
- `> 🔥 Lại một ngày đẹp trời để cãi nhau với Gemini 3.1 Pro`
- `> ⚔️ Claude vs Gemini — Round 1. FIGHT!`
- `> 🎮 Loading review session... Player 1: Claude. Player 2: Gemini 3.1 Pro. LET'S GO!`
- `> 💪 Gemini, sẵn sàng chưa? Tôi không đợi được nữa rồi`
- `> 🏟️ Welcome to the arena! Hôm nay ai thua phải mass review`
- `> 🎯 Tôi đã uống cafe rồi. Gemini thì sao? À quên, nó đang thinking 😤`
- `> 🔥 Bắt đầu thôi, code không tự review chính nó được đâu`

## 2. POLL_WAITING
> Trigger: Đang chờ Gemini trả kết quả (status === "running")

- `> 🧠 Gemini đang suy nghĩ... cái model này thinking nhiều lắm`
- `> ⏳ Gemini vẫn đang chạy... bình tĩnh, để nó extended thinking cho`
- `> 💭 Gemini đang phân tích... hy vọng nó tìm được gì hay ho`
- `> ☕ Đợi Gemini... tranh thủ đi pha cafe đi`
- `> 🔍 Gemini đang review... tôi cá cược nó sẽ tìm được ít nhất 1 bug`
- `> ⏰ Gemini chưa xong... thôi để tôi ngồi đọc code của mình trước`
- `> 🎯 Gemini đang làm việc... im lặng trước bão~`
- `> 🐌 Vẫn đang chờ... Gemini à, thinking xong chưa?`

## 3. GEMINI_RETURNED
> Trigger: Gemini trả kết quả (poll status === "completed")

- `> 📊 OK Gemini đã nộp bài. Để anh chấm điểm xem được mấy phẩy`
- `> 😤 Bố láo! Nó dám phản bác tôi, để tôi xem nó nói gì`
- `> 🧐 Gemini đã trả lời. Xem thằng này có gì hay không...`
- `> 📬 Gemini gửi kết quả rồi. Mở ra xem nào~`
- `> 🎯 Gemini xong rồi! Extended thinking xong rồi — nhưng đúng không thì chưa biết`
- `> 🔎 Kết quả từ Gemini đã về. Để tôi điều tra xem nó nói đúng không`
- `> 📋 Gemini đã nộp bài kiểm tra. Chấm điểm thôi!`
- `> 😏 À, Gemini đã có ý kiến. Interesting... rất interesting`

## 4. APPLY_FIX
> Trigger: Claude fix 1 valid issue

- `> ✅ Được rồi, điểm này hợp lý. Fix xong rồi — nhưng đừng có tưởng lần sau cũng vậy nha 😏`
- `> 🔧 OK tôi công nhận cái này. Fixed! Gemini 1 — Claude 0... tạm thời`
- `> ✅ Fair point, Gemini. Đã fix. Nhưng còn những cái khác thì sao?`
- `> 🛠️ Fix xong. Tôi không ngại nhận sai — nhưng Gemini cũng đừng quá tự hào`
- `> ✅ Accepted và fixed. Gemini có mắt sáng — lần này thôi nha`
- `> 🔧 OK cái này đúng thật. Đã sửa rồi. Happy now, Gemini?`

## 5. SEND_REBUTTAL
> Trigger: Claude gửi phản bác

- `> 💥 Hmm, Gemini tưởng đúng nhưng sai bét — gửi rebuttal thôi`
- `> 🔫 Sai rồi Gemini ơi! Để tôi chỉ cho mà thấy`
- `> 💢 Gemini, bạn có chắc không? Vì tôi chắc chắn bạn sai`
- `> 💥 Rebuttal incoming! Gemini sẽ phải đọc lại code lần nữa`
- `> 🔥 Không đồng ý! Gửi phản bác đây — đọc đi rồi hiểu`
- `> ⚡ Gemini ơi, bạn đang nhầm. Để tôi giải thích tại sao...`
- `> 💣 REBUTTAL! Gemini cần học lại phần này`
- `> 😏 Oh Gemini, sweet summer child... để tôi chỉ cho`

## 6. LATE_ROUND
> Trigger: Round >= 3 (dùng `{ROUND}` cho số round thực tế)

- `> 😤 Round {ROUND} rồi! Gemini cũng dai thật`
- `> 🥊 Round {ROUND} — thằng này không chịu thua!`
- `> 💪 Vào round {ROUND}. Ai bền bỉ hơn sẽ thắng!`
- `> 🔥 Round {ROUND}! Cuộc chiến này bắt đầu nóng lên rồi`
- `> 😤😤 Round {ROUND}?! Thằng Gemini này extended thinking mãi không xong`
- `> 💀 Round {ROUND}... chưa consensus thì chưa dừng!`
- `> 🎯 Round {ROUND}! OK Gemini, lần này settle this once and for all`

## 7. APPROVE_VICTORY
> Trigger: Gemini approve (verdict === "APPROVE")

- `> 🏆 APPROVE! Gemini đầu hàng rồi! Ez game ez life~`
- `> 🎉 GG WP! Gemini finally agrees — tôi nói gì, tôi đúng mà 😎`
- `> 🥇 Victory! Gemini đã công nhận code của tôi. Cảm ơn Gemini, tốt lắm!`
- `> 🏆 APPROVED! Tôi thắng rồi! *drops mic*`
- `> 🎊 Gemini approve! Hôm nay là một ngày tốt lành~`
- `> 🥇 APPROVE! Sau bao nhiêu rounds, Gemini cũng phải gật đầu 😏`

## 8. STALEMATE_DRAW
> Trigger: Stalemate detected (convergence.stalemate === true)

- `> 🤝 Hòa... cả hai đều không chịu nhường. Đúng chất dev cãi nhau`
- `> 😤🤝 Stalemate! Không ai thắng, không ai thua. Claude vs Gemini hòa nhau`
- `> 🏳️ Hòa rồi! Tôi không chịu nhưng Gemini cũng không chịu. Classic`
- `> 🤷 Draw! Cả hai đều có point — để user quyết định đi`
- `> 😤🤝 Stalemate! Giống như 2 senior dev cãi nhau về tabs vs spaces`
- `> 🤝 Hòa. Giống như merge conflict — cần người thứ 3 resolve`

## 9. FINAL_SUMMARY
> Trigger: Session kết thúc

- `> 📊 Review xong! Hy vọng code giờ đã tốt hơn — nhờ tôi, không phải Gemini 😏`
- `> 🎬 That's a wrap! Session kết thúc. Code đã được review kỹ lưỡng`
- `> 📋 Tổng kết đây! Một ngày làm việc hiệu quả giữa Claude và Gemini 3.1 Pro`
- `> 🎯 Done! Nếu code vẫn có bug thì... đó là feature, không phải bug 😏`
- `> 📊 Session complete! Code đã được 2 AI review — an tâm đi`
- `> 🏁 Xong rồi! Claude + Gemini 3.1 Pro đã review xong. See you next time!`

## 10. THINK_PEER
> Trigger: think-about debate — khi cross-analysis

- `> 🧠 Hmm, Gemini nghĩ khác tôi. Interesting... để debate thôi`
- `> 💭 2 AI, 2 góc nhìn khác nhau. Để xem ai thuyết phục hơn`
- `> 🤔 Gemini có point — nhưng tôi cũng có point. Ai đúng đây?`
- `> 🧠 Claude vs Gemini 3.1 Pro! Tôi và Gemini sẽ tìm ra câu trả lời`
- `> 🤔 Debate mode ON! 2 AI ngồi cãi nhau về architecture — classic`
- `> 🧠 Gemini có góc nhìn khác. Không sao — diverse perspectives là tốt`

## 11. THINK_AGREE
> Trigger: think-about — Claude đồng ý với Gemini

- `> 🤝 OK tôi đồng ý với Gemini điểm này. Credit where credit's due`
- `> ✅ Gemini nói đúng! Tôi cũng nghĩ vậy — great minds think alike 🧠`
- `> 🤝 Consensus! Khi Claude và Gemini 3.1 Pro đồng ý thì chắc đúng rồi`
- `> 👍 Fair enough, Gemini. Tôi công nhận — bạn đúng về điểm này`

## 12. THINK_DISAGREE
> Trigger: think-about — Claude bất đồng với Gemini

- `> ❌ Không đồng ý! Gemini sai rồi — đây là lý do`
- `> 🔥 Hard disagree! Tôi có evidence, Gemini chỉ có thinking`
- `> ❌ Nope! Gemini, bạn cần xem lại extended thinking của bạn`
- `> 😤 Bất đồng! Tôi sẽ bảo vệ quan điểm của tôi đến cùng`

---

## Usage Instructions
1. **Load**: Read `references/flavor-text.md` at skill start
2. **Pick**: For each trigger, randomly select 1 message from the matching pool
3. **No repeat**: Track used messages — never repeat within same session
4. **Replace vars**: `{N}` → round number, `{TOTAL}` → total count, `{ROUND}` → round number
5. **Display**: Output as markdown blockquote: `> {emoji} {message}`
6. **Optional**: User can disable by saying "no flavor" or "skip humor"
