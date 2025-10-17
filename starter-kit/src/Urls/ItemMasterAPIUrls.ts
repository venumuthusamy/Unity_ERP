export class ItemMasterAPIUrls {
  // Controller base: [Route("api/[controller]")] => api/ItemMaster
  public static readonly GetItems             = "/ItemMaster/GetItems";
  public static readonly GetItemById          = "/ItemMaster/GetItemById/";        // + {id}
  public static readonly CreateItem           = "/ItemMaster/CreateItem";
  public static readonly UpdateItemById       = "/ItemMaster/UpdateItemById/";     // + {id}
  public static readonly DeleteItemById       = "/ItemMaster/DeleteItemById/";     // + {id}
  public static readonly getItemAudit         = "/ItemMaster/Audit/";
  public static readonly getItemWarehouse         = "/ItemMaster/GetWarehouse/";
  public static readonly getItemSupplier        = "/ItemMaster/GetSupplier/";
  
}

