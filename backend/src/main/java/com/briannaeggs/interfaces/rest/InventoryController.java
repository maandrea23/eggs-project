package com.briannaeggs.interfaces.rest;
import com.briannaeggs.application.service.InventoryService;
import com.briannaeggs.domain.model.EggSaleType;
import java.util.Map;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/inventory")
public class InventoryController { private final InventoryService inventory; public InventoryController(InventoryService inventory){this.inventory=inventory;} @GetMapping("/eggs") public Map<EggSaleType,Integer> stock(){return inventory.stock();} }
