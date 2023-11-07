const { v4: uuidv4 } = require('uuid');

exports = async function(changeEvent) {
  const ALLOWED_COLLECTIONS = ['Contact', 'ServiceItemService'];
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
    const currentTime = new Date();
    const ctsString = currentTime.toISOString().replace('T', ' ').replace('Z', '');
    const bsonTimestamp = new mongodb.BSON.Timestamp(0, Math.floor(currentTime / 1000));
    
    if (operationType === 'insert') {
      let newDocument = changeEvent.fullDocument;
      newDocument.id = uuidv4();
      newDocument.cts = ctsString;
      newDocument.ts = bsonTimestamp;
      
      await targetCollection.insertOne(newDocument);
      console.log(`Document inserted in ${TARGET_DB} database: ${newDocument._id}`);
    } else if (operationType === 'update') {
      const updateDescription = changeEvent.updateDescription;
      const updatedFields = updateDescription.updatedFields;
      const removedFields = updateDescription.removedFields;
      updatedFields.ts = bsonTimestamp;
      const hasChanges = Object.keys(updatedFields).length > 0 || removedFields.length > 0;

      if (hasChanges) {
        await targetCollection.updateOne(
          { _id: changeEvent.documentKey._id },
          { $set: updatedFields }
        );
        console.log(`Document updated in ${TARGET_DB} database: ${changeEvent.documentKey._id}`);
      } else {
        console.log(`Update ignored due to no relevant changes: ${changeEvent.documentKey._id}`);
      }
    } else if (operationType === 'delete') {
      const docId = changeEvent.documentKey._id;
      await targetCollection.deleteOne({ _id: docId });
      console.log(`Document deleted in ${TARGET_DB} database: ${docId}`);
    }
  } catch (err) {
    console.error(`Error with ${operationType} operation: ${err}`);
  }
};
