const { v4: uuidv4 } = require('uuid');

exports = async function(changeEvent) {
  const ALLOWED_COLLECTIONS = ['Contact', 'ServiceItemService'];
  const TARGET_DB = 'test_vfs';
  
  const mongodb = context.services.get('mongodb-atlas');
  const operationType = changeEvent.operationType;
  const sourceCollection = changeEvent.ns.coll;
  const session = mongodb.startSession(); // Start a new session for the transaction

  if (!ALLOWED_COLLECTIONS.includes(sourceCollection)) {
    console.log(`Ignored operation on collection: ${sourceCollection}`);
    return;
  }
  
  let targetDatabase = mongodb.db(TARGET_DB);
  let targetCollection = targetDatabase.collection(sourceCollection);
  
  try {
    session.startTransaction(); // Start the transaction

    const currentTimeString = new Date().toISOString().replace('T', ' ').replace(/\..+/, '');
    
    if (operationType === 'insert') {
      let newDocument = changeEvent.fullDocument;
      newDocument.id = uuidv4();
      newDocument.cts = currentTimeString; // Set 'cts' as a string of the current timestamp

      // Check if the document already exists
      const exists = await targetCollection.findOne({ _id: newDocument._id }, { session });
      if (!exists) {
        // Insert the document
        await targetCollection.insertOne(newDocument, { session });
        // Then immediately update it to set the 'ts' field with a BSON Timestamp
        await targetCollection.updateOne(
          { _id: newDocument._id },
          { $currentDate: { ts: { $type: "timestamp" } } },
          { session }
        );
        console.log(`Document inserted in ${TARGET_DB} database with _id: ${newDocument._id}`);
      } else {
        console.log(`Document with _id: ${newDocument._id} already exists. Skipping insert.`);
        await session.abortTransaction(); // Abort the transaction as the document exists
        return;
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
    await session.commitTransaction(); // Commit the transaction
  } catch (err) {
    console.error(`Error with ${operationType} operation: ${err}`);
    await session.abortTransaction(); // Abort the transaction on error
  } finally {
    session.endSession(); // End the session regardless of success or error
  }
};
