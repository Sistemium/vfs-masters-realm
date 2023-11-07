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
    const currentTimeString = new Date().toISOString().replace('T', ' ').replace(/\..+/, '');
    const currentTimestamp = new Date(); // MongoDB stores this as ISODate by default.
    
    if (operationType === 'insert') {
      let newDocument = changeEvent.fullDocument;
      newDocument.id = uuidv4();
      newDocument.cts = currentTimeString; // Set 'cts' as a string of the current timestamp
      
      // Check if the document already exists
      const exists = await targetCollection.findOne({ _id: newDocument._id });
      if (!exists) {
        newDocument.ts = currentTimestamp; // Set 'ts' to the current date and time.
        
        await targetCollection.insertOne(newDocument);
        console.log(`Document inserted in ${TARGET_DB} database with _id: ${newDocument._id}`);
      } else {
        console.log(`Document with _id: ${newDocument._id} already exists. Skipping insert.`);
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
            $currentDate: { ts: true } // Set 'ts' to the current date and time.
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
  }
};
