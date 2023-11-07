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
    if (operationType === 'insert') {
      let newDocument = changeEvent.fullDocument;
      newDocument.id = uuidv4(); // Add UUID to the new document
      
      // Use the $currentDate operator to add a cts field with the current timestamp as a Date
      await targetCollection.insertOne({
        ...newDocument,
        cts: { $type: "timestamp" } // This will be converted to a Timestamp by MongoDB
      });
      console.log(`Document inserted in ${TARGET_DB} database: ${newDocument._id}`);
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
            $currentDate: { ts: { $type: "timestamp" } } // Set the 'ts' field to the current timestamp
          }
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
