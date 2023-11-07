exports = async function(changeEvent) {
  const ALLOWED_COLLECTIONS = ['Contact', 'ServiceItemService'];
  const TARGET_DB = 'test_masters';
  
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
      newDocument.id = generateUUID();
      
      await targetCollection.insertOne(newDocument);
      console.log(`Document inserted in ${TARGET_DB} database: ${newDocument._id}`);
    } else if (operationType === 'update') {
      const updateDescription = changeEvent.updateDescription;
      const updatedFields = updateDescription.updatedFields;
      const removedFields = updateDescription.removedFields;
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

function generateUUID() {
  return "test"
}
