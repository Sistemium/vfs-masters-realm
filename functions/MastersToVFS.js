const { v4: uuidv4 } = require('uuid');

exports = async function(changeEvent) {
  const toTransfer = context.values.get("SourceCollectionMap");
  const ALLOWED_COLLECTIONS = toTransfer.map(entry => entry.coll);
  const TARGET_DB = 'test_vfs';

  const mongodb = context.services.get('mongodb-atlas');
  const operationType = changeEvent.operationType;
  const sourceCollection = changeEvent.ns.coll;

  if (!ALLOWED_COLLECTIONS.includes(sourceCollection)) {
    console.log(`Ignored operation on collection: ${sourceCollection}`);
    return;
  }

  let targetDatabase = mongodb.db(TARGET_DB);
  let targetCollection = targetDatabase.collection(sourceCollection);

  try {
    const currentTimeString = new Date().toISOString().replace('T', ' ').replace(/\..+/, '');

    if (operationType === 'insert') {
      const session = await mongodb.startSession();
      const transactionOptions = {
        readPreference: { readConcern: { level: 'local' } },
        writeConcern: { w: 1 }
      };
      const transaction = await session.startTransaction(transactionOptions);

      try {
        let newDocument = changeEvent.fullDocument;
        newDocument.id = uuidv4();
        newDocument.cts = currentTimeString;
        const exists = await targetCollection.findOne({ _id: newDocument._id });

        if (!exists) {
          await targetCollection.insertOne(newDocument);
          await targetCollection.updateOne(
            { _id: newDocument._id },
            { $currentDate: { ts: { $type: "timestamp" } } }
          );
          console.log(`Document inserted in ${TARGET_DB} database with _id: ${newDocument._id}`);
        } else {
          console.log(`Document with _id: ${newDocument._id} already exists. Skipping insert.`);
        }

        await transaction.commit();
      } catch (err) {
        console.error(`Error with ${operationType} operation: ${err}`);
        await transaction.abort();
      } finally {
        await session.endSession();
      }
    } else if (operationType === 'update') {
      const updateDescription = changeEvent.updateDescription;
      const updatedFields = updateDescription.updatedFields;
      const removedFields = updateDescription.removedFields;
      const hasChanges = Object.keys(updatedFields).length > 0 || removedFields.length > 0;

      if (hasChanges) {
        await targetCollection.updateOne(
          { _id: changeEvent.documentKey._id },
          {
            $set: updatedFields,
            $currentDate: { ts: { $type: "timestamp" } }
          }
        );
        console.log(`Document updated in ${TARGET_DB} database with _id: ${changeEvent.documentKey._id}`);
      } else {
        console.log(`No relevant changes to update for _id: ${changeEvent.documentKey._id}`);
      }
    } else if (operationType === 'delete') {
      const docId = changeEvent.documentKey._id;
      await targetCollection.deleteOne({ _id: docId });
      console.log(`Document deleted from ${TARGET_DB} database with _id: ${docId}`);
    }
  } catch (err) {
    console.error(`Error with ${operationType} operation: ${err}`);
    throw err;
  }
};