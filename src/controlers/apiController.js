// Feed Controller.js
import crypto from "crypto";
import db from "../db";

export const postCheckId = async (req, res) => {
  const {
    body: { checkWord }
  } = req;

  try {
    await db.query(
      "SELECT * FROM Users WHERE `id`=?",
      [checkWord],
      (err, rows) => {
        if (!rows[0]) {
          res.end("true");
        } else {
          res.end("false");
        }
      }
    );
  } catch (error) {
    res.status(400);
  }
};

export const postChaeckChangePw = async (req, res) => {
  const {
    body: { checkChangePw }
  } = req;
  try {
    await db.query(
      "SELECT * FROM Users WHERE `id`=?",
      [req.user.id],
      (err, rows) => {
        const checkUser = rows[0];
        // 암호화 비밀번호 확인
        crypto.pbkdf2(
          // 넘어 온 비밀번호
          checkChangePw,
          // 확인 할 유저의 솔트
          checkUser.pw_salt,
          parseInt(process.env.CRYPTO_SECRET, 10),
          parseInt(process.env.CRYPTO_OPTION1, 10),
          process.env.CRYPTO_OPTION2,
          (err, key) => {
            if (key.toString("base64") === checkUser.pw) {
              // 로그인 성공
              res.end("true");
            } else {
              // 비밀번호가 일치하지 않습니다.
              res.end("false");
            }
          }
        );
      }
    );
  } catch (error) {
    res.status(400);
  }
};

export const postRandomFriendRemove = async (req, res) => {
  const {
    body: { nowViewListId }
  } = req;
  try {
    const $selectAddRandomFriend = `SELECT idx, name, profile from Users WHERE not idx = any(SELECT friendIdx FROM FriendList WHERE myIdx = "${
      req.user.idx
    }") AND idx NOT IN ("${req.user.idx}", "${nowViewListId[0]}", "${
      nowViewListId[1]
    }", "${nowViewListId[2]}" ,"${nowViewListId[3]}") order by rand() limit 1;`;
    await db.query($selectAddRandomFriend, (err, rows) => {
      if (err) throw err;
      if (rows.length !== 0) {
        res.status(200).json({ rows: rows[0] });
        res.end();
      } else {
        res.status(200).json({ rows: null });
        res.end();
      }
    });
  } catch (error) {
    res.status(400);
    res.end();
  }
};

// Random Add Friend 같이 씀
export const postAddFriend = async (req, res) => {
  const {
    body: { targetIdx, whatDo, nowViewListId }
  } = req;
  const $FriendInOut = "INSERT INTO WaitFriendList set ? ;";
  const $dataObj = {
    senderIdx: req.user.idx,
    recipientIdx: targetIdx
  };
  try {
    if (whatDo === "addRandomFriend") {
      const $selectAddRandomFriend = `SELECT idx, name, profile from Users WHERE not idx = any(SELECT friendIdx FROM FriendList WHERE myIdx = "${
        req.user.idx
      }") AND idx NOT IN ("${req.user.idx}", "${nowViewListId[0]}", "${
        nowViewListId[1]
      }", "${nowViewListId[2]}" ,"${
        nowViewListId[3]
      }") order by rand() limit 1;`;
      await db.query(
        $FriendInOut + $selectAddRandomFriend,
        $dataObj,
        (err, rows) => {
          if (err) throw err;
          if (rows[1].length !== 0) {
            res.status(200).json({ rows: rows[1][0] });
            res.end();
          } else {
            res.status(200).json({ rows: null });
            res.end();
          }
        }
      );
    } else {
      db.query($FriendInOut, $dataObj, err => {
        if (err) throw err;
        res.status(200);
        res.end();
      });
    }
  } catch (error) {
    res.status(400);
    res.end();
  }
};

export const postDeleteFriend = (req, res) => {
  const {
    body: { targetIdx }
  } = req;
  const $deleteFriendList = `delete from FriendList where myIdx = "${targetIdx}" and friendIdx = "${
    req.user.idx
  }" or myIdx = "${req.user.idx}" and friendIdx = "${targetIdx}";`;
  try {
    db.query($deleteFriendList, err => {
      if (err) throw err;
      res.status(200);
    });
  } catch (error) {
    res.status(400);
  } finally {
    res.end();
  }
};

export const postConfirmFriend = (req, res) => {
  const {
    body: { targetIdx }
  } = req;
  const $deleteWaitFriendList = `delete from WaitFriendList where senderIdx = "${targetIdx}" and recipientIdx = "${
    req.user.idx
  }";`;
  const $insertFriendList = `insert into FriendList (myIdx, friendIdx) values ("${
    req.user.idx
  }", "${targetIdx}"), ("${targetIdx}", "${req.user.idx}");`;
  try {
    db.query($deleteWaitFriendList + $insertFriendList, err => {
      if (err) throw err;
      res.status(200);
    });
  } catch (error) {
    res.status(400);
  } finally {
    res.end();
  }
};

export const postCancelFriend = (req, res) => {
  const {
    body: { targetIdx }
  } = req;
  const $deleteWaitFriendList = `delete from WaitFriendList where senderIdx = "${targetIdx}" and recipientIdx = "${
    req.user.idx
  }" or senderIdx = "${req.user.idx}" and recipientIdx = "${targetIdx}";`;
  try {
    db.query($deleteWaitFriendList, err => {
      if (err) throw err;
      res.status(200);
    });
  } catch (error) {
    res.status(400);
  } finally {
    res.end();
  }
};

export const postLikeCount = async (req, res) => {
  const {
    body: { targetIdx, action }
  } = req;
  let $updateLike;
  let $likeListQuery;
  const $selectFeedLike = `select likes from Feeds where idx = "${targetIdx}"`;
  if (action) {
    $updateLike = `UPDATE Feeds SET LIKES = LIKES + 1 WHERE idx="${targetIdx}";`;
    $likeListQuery = `insert into FeedLikeList (userIdx, feedIdx) values("${
      req.user.idx
    }", "${targetIdx}");`;
  } else {
    $updateLike = `UPDATE Feeds SET LIKES = LIKES - 1 WHERE idx="${targetIdx}";`;
    $likeListQuery = `delete from FeedLikeList where userIdx = "${
      req.user.idx
    }" and feedIdx = "${targetIdx}";`;
  }
  try {
    await db.query(
      $updateLike + $likeListQuery + $selectFeedLike,
      (err, rows) => {
        if (err) throw err;

        res.status(200).json({ likeCount: rows[2][0].likes });
        res.end();
      }
    );
  } catch (error) {
    res.status(400);
    res.end();
  }
};

export const postSelectFeedPaging = async (req, res) => {
  const {
    body: { feedPagingNumber, typeOrOtherIdx }
  } = req;

  const pagingSet = 3;

  let $feedJoinUserPaging;

  if (typeOrOtherIdx === "main") {
    $feedJoinUserPaging = `select Feeds.idx, writer, writer_idx, fromIdx, fromName, createdAt, fileUrl, description, likes, comments, profile, edited from Feeds left join Users on Feeds.writer_idx = Users.idx ORDER BY Feeds.createdAt DESC LIMIT ${feedPagingNumber *
      pagingSet +
      5}, ${pagingSet};`;
  } else {
    $feedJoinUserPaging = `select Feeds.idx, writer, writer_idx, fromIdx, fromName, createdAt, fileUrl, description, likes, comments, profile, edited from Feeds left join Users on Feeds.writer_idx = Users.idx WHERE Feeds.fromIdx = "${typeOrOtherIdx}" ORDER BY Feeds.createdAt DESC LIMIT ${feedPagingNumber *
      pagingSet +
      5}, ${pagingSet};`;
  }

  const $likeListSelect = `select feedIdx from FeedLikeList where userIdx = "${
    req.user.idx
  }";`;

  try {
    await db.query($feedJoinUserPaging + $likeListSelect, (err, rows) => {
      if (err) throw err;

      const likeList = [];

      for (let i = 0; i < rows[1].length; i++) {
        likeList.push(rows[1][i].feedIdx);
      }

      res.status(200).json({ feedList: rows[0], likeList });
      res.end();
    });
  } catch (error) {
    console.log(error);
    res.status(400);
    res.end();
  }
};
export const postSelectSearchPaging = async (req, res) => {
  const {
    body: { feedPagingNumber, searchWord }
  } = req;

  const pagingSet = 3;

  const $feedJoinUserPaging = `select Feeds.idx, writer, writer_idx, comments, createdAt, fileUrl, description, likes, profile from Feeds left join Users on Feeds.writer_idx = Users.idx where Feeds.writer like "%${searchWord}%" or Feeds.description like "%${searchWord}%" ORDER BY Feeds.createdAt DESC LIMIT ${feedPagingNumber *
    pagingSet +
    3}, ${pagingSet};`;

  const $likeListSelect = `select feedIdx from FeedLikeList where userIdx = "${
    req.user.idx
  }";`;

  try {
    await db.query($feedJoinUserPaging + $likeListSelect, (err, rows) => {
      if (err) throw err;

      const likeList = [];

      for (let i = 0; i < rows[1].length; i++) {
        likeList.push(rows[1][i].feedIdx);
      }

      res.status(200).json({ searchList: rows[0], likeList });
      res.end();
    });
  } catch (error) {
    console.log(error);
    res.status(400);
    res.end();
  }
};

export const postSelectComment = async (req, res) => {
  const {
    body: { targetIdx, pageNumber }
  } = req;

  const pagingSet = 3;

  const $commentJoinUser = `select CommentList.idx, feedIdx, writerIdx, createdAt, description, commentCount, profile, edited, name FROM CommentList left join Users on CommentList.writerIdx = Users.idx where feedIdx = "${targetIdx}" ORDER BY idx desc LIMIT ${pageNumber *
    pagingSet}, ${pagingSet};`;

  try {
    await db.query($commentJoinUser, (err, rows) => {
      if (err) throw err;
      res.status(200).json({ commentList: rows });
      res.end();
    });
  } catch (error) {
    console.log(error);
    res.status(400);
    res.end();
  }
};

export const postAddComment = async (req, res) => {
  const {
    body: { feedIdx, description }
  } = req;

  const $insetComment = `insert into CommentList set ? ;`;
  const $commentDate = {
    feedIdx,
    description,
    writerIdx: req.user.idx
  };
  const $updateCocommentCountUp = `UPDATE Feeds set comments = (SELECT SUM(commentCount) FROM CommentList WHERE feedIdx = "${feedIdx}") WHERE Feeds.idx = "${feedIdx}";`;
  const $selectCommentCount = `select comments from Feeds where idx = "${feedIdx}";`;

  try {
    await db.query(
      $insetComment + $updateCocommentCountUp + $selectCommentCount,
      $commentDate,
      (err, rows) => {
        if (err) throw err;

        res.status(200).json({
          insertIdx: rows[0].insertId,
          feedCommentCount: rows[2][0].comments
        });
        res.end();
      }
    );
  } catch (error) {
    console.log(error);
    res.status(400);
    res.end();
  }
};

export const postEditComment = async (req, res) => {
  const {
    body: { idx, description }
  } = req;

  const $updateComment = `update CommentList set ? where idx = "${idx}";`;
  const $data = {
    description,
    edited: " ·　Edited"
  };
  try {
    await db.query($updateComment, $data, err => {
      if (err) throw err;
      res.status(200);
    });
  } catch (error) {
    console.log(error);
    res.status(400);
  } finally {
    res.end();
  }
};

export const postDeleteComment = async (req, res) => {
  const {
    body: { commentIdx, feedIdx }
  } = req;

  const $deleteComment = `delete from CommentList where idx = "${commentIdx}" ;`;
  const $deleteCocomment = `delete from CocommentList where commentIdx = "${commentIdx}" ;`;
  const $updateCommentCountDown = `UPDATE Feeds set comments = (SELECT SUM(commentCount) FROM CommentList WHERE feedIdx = "${feedIdx}") WHERE Feeds.idx = "${feedIdx}";`;
  const $selectCommentCount = `select comments from Feeds where idx = "${feedIdx}";`;
  try {
    await db.query(
      $deleteComment +
        $deleteCocomment +
        $updateCommentCountDown +
        $selectCommentCount,
      (err, rows) => {
        if (err) throw err;
        res.status(200).json({
          feedCommentCount:
            rows[3][0].comments !== null ? rows[3][0].comments : 0
        });
        res.end();
      }
    );
  } catch (error) {
    console.log(error);
    res.status(400);
    res.end();
  }
};

export const postSelectCocomment = async (req, res) => {
  const {
    body: { commentIdx }
  } = req;

  const $cocommentJoinUser = `select CocommentList.idx, commentIdx, writerIdx, createdAt, description, profile, edited, name FROM CocommentList left join Users on CocommentList.writerIdx = Users.idx WHERE commentIdx = "${commentIdx}";`;

  try {
    db.query($cocommentJoinUser, (err, rows) => {
      if (err) throw err;
      res.status(200).json({ cocommentList: rows });
      res.end();
    });
  } catch (error) {
    console.log(error);
    res.status(400);
    res.end();
  }
};

export const postAddCocomment = async (req, res) => {
  const {
    body: { commentIdx, description, feedIdx }
  } = req;

  const $insetCocomment = `insert into CocommentList set ? ;`;
  const $updateCocommentCountUp = `update CommentList set commentCount = commentCount + 1 where idx = "${commentIdx}";`;
  const $commentDate = {
    commentIdx,
    description,
    writerIdx: req.user.idx
  };
  const $updateCommentCountUp = `UPDATE Feeds set comments = (SELECT SUM(commentCount) FROM CommentList WHERE feedIdx = "${feedIdx}") WHERE Feeds.idx = "${feedIdx}";`;
  const $selectCommentCount = `select comments from Feeds where idx = "${feedIdx}";`;

  try {
    await db.query(
      $insetCocomment +
        $updateCocommentCountUp +
        $updateCommentCountUp +
        $selectCommentCount,
      $commentDate,
      (err, rows) => {
        if (err) throw err;
        res.status(200).json({
          insertIdx: rows[0].insertId,
          feedCommentCount: rows[3][0].comments
        });
        res.end();
      }
    );
  } catch (error) {
    console.log(error);
    res.status(400);
    res.end();
  }
};

export const postEditCocomment = async (req, res) => {
  const {
    body: { idx, description }
  } = req;

  const $insertComment = `update CocommentList set ? where idx = "${idx}";`;
  const $data = {
    description,
    edited: " ·　Edited"
  };
  try {
    await db.query($insertComment, $data, err => {
      if (err) throw err;
      res.status(200);
    });
  } catch (error) {
    console.log(error);
    res.status(400);
  } finally {
    res.end();
  }
};

export const postDeleteCocomment = async (req, res) => {
  const {
    body: { commentIdx, cocommentIdx, feedIdx }
  } = req;

  const $deleteCocomment = `delete from CocommentList where idx = "${cocommentIdx}";`;
  const $updateCountDown = `update CommentList set commentCount = commentCount - 1 where idx = "${commentIdx}";`;
  const $updateCommentCountDown = `UPDATE Feeds set comments = (SELECT SUM(commentCount) FROM CommentList WHERE feedIdx = "${feedIdx}") WHERE Feeds.idx = "${feedIdx}";`;
  const $selectCommentCount = `select comments from Feeds where idx = "${feedIdx}";`;

  try {
    await db.query(
      $deleteCocomment +
        $updateCountDown +
        $updateCommentCountDown +
        $selectCommentCount,
      (err, rows) => {
        if (err) throw err;
        res.status(200).json({ feedCommentCount: rows[3][0].comments });
        res.end();
      }
    );
  } catch (error) {
    console.log(error);
    res.status(400);
    res.end();
  }
};
