exports = function(data) {
    const userId = context.user.id;
    const collection = context.services.get("mongodb-atlas").db("Masters").collection("User");
    const $set = {
      ...data,
      ts: new Date(),
    };
    return collection.updateOne({ _id: userId }, { $set });
};