exports = async function writeCustomUserData(newCustomUserData) {
  const userId = context.user.id;
  const customUserDataCollection = context.services
    .get("mongodb-atlas")
    .db("Masters")
    .collection("User");
  const filter = { '_id': userId };
  const update = { $set: newCustomUserData };
  const options = { upsert: true };
  const res = await customUserDataCollection.updateOne(filter, update, options);
  return res;
};