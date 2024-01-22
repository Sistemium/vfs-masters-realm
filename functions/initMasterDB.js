import { flatten } from "lodash";
import eachSeries from "async/eachSeries";

exports = async function (arg = {}) {
  // This default function will get a value and find a document in MongoDB
  // To see plenty more examples of what you can do with functions see:
  // https://www.mongodb.com/docs/atlas/app-services/functions/

  const UNSET = ["id", "ts", "cts", "deviceUUID", "deviceCts"];
  const OUT_DB = arg.out || "Masters";
  const IN_DB = arg.source || "VFS";

  const serviceName = "mongodb-atlas";
  const source = context.services.get(serviceName).db(IN_DB);
  const dest = context.services.get(serviceName).db(OUT_DB);

  const toTransfer = context.values.get("SourceCollectionMap");

  if (!toTransfer) {
    throw Error("not found SourceCollectionMap value");
  }

  await eachSeries(toTransfer, (transfer, cb) => {
    copyCollection(transfer)
      .then(() => cb(null))
      .catch((e) => cb(e));
  });

  async function copyCollection(transfer) {
    const { coll, unset = [], rels = [], filter, pre = [] } = transfer;
    const $unset = [...UNSET, ...unset];
    const { rename = coll } = transfer;
    console.log('starting collection:', coll, ' rename:', rename);

    if (await dest.collection(rename).count()) {
      console.log('ignore non-empty', coll);
      return;
    }

    const lookups = rels.map(({ from, field, optional = false, as }) => [
      {
        $lookup: {
          from,
          as: "p",
          localField: field,
          foreignField: "id",
        },
      },
      { $unwind: { path: "$p", preserveNullAndEmptyArrays: optional } },
      { $set: { [as || field.replace(/Id$/, "")]: "$p._id" } },
      { $unset: ["p", field] },
    ]);

    const $match = [];

    if (filter) {
      $match.push({ $match: filter });
    }
    
    pre.forEach(p => console.log(JSON.stringify(p)));

    await source
      .collection(coll)
      .aggregate([
        ...pre,
        ...$match,
        { $unset },
        ...flatten(lookups),
        { $out: { db: OUT_DB, coll: rename } },
      ])
      .toArray();

    console.log("done", coll);
  }
};
